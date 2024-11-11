#!/usr/bin/env bash

set -e
set -u
set -x
PROJECT_NAME="$1"
TSV_PATH="./allreports/module_tasks.tsv"

# Validate gh CLI is installed
if ! command -v gh &>/dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    exit 1
fi

# Validate gh auth status
if ! gh auth status &>/dev/null; then
    echo "Error: Not authenticated with GitHub. Please run 'gh auth login' first"
    exit 1
fi

# Create project and get project number
PROJECT_NO=$(gh project create --owner "@me" --title "$PROJECT_NAME" --format json | jq -r '.number')

gh project field-list "$PROJECT_NO" --owner "@me" --format json

# Create custom fields
for field in "Type" "Complexity" "EstimatedTime" "Dependencies"; do
    echo "Creating field: $field"
    gh project field-create "$PROJECT_NO" \
        --owner "@me" \
        --data-type "TEXT" \
        --name "$field" || {
        echo "Error: Failed to create field '$field'"
        exit 1
    }
done

# Get field IDs with correct JSON path
PROJECT_GLOBAL_ID=$(gh api graphql -f query="query{viewer{projectV2(number:$PROJECT_NO){id}}}" | jq -r '.data.viewer.projectV2.id')
TYPE_FIELD_ID=$(gh project field-list "$PROJECT_NO" --owner "@me" --format json | jq -r '.fields[] | select(.name=="Type") | .id')
COMPLEXITY_FIELD_ID=$(gh project field-list "$PROJECT_NO" --owner "@me" --format json | jq -r '.fields[] | select(.name=="Complexity") | .id')
TIME_FIELD_ID=$(gh project field-list "$PROJECT_NO" --owner "@me" --format json | jq -r '.fields[] | select(.name=="EstimatedTime") | .id')
DEPS_FIELD_ID=$(gh project field-list "$PROJECT_NO" --owner "@me" --format json | jq -r '.fields[] | select(.name=="Dependencies") | .id')

# Import items from TSV
while IFS=$'\t' read -r title type complexity time deps; do
    # Skip empty lines
    [ -z "$title" ] && continue

    echo "Creating item: $title"
    ITEM_ID=$(gh project item-create "$PROJECT_NO" --owner "@me" --title "$title" --format json | jq -r '.id') || {
        echo "Error: Failed to create item '$title'"
        continue
    }

    if [ -n "$type" ]; then
        gh project item-edit --project-id "$PROJECT_GLOBAL_ID" --id "$ITEM_ID" --field-id "$TYPE_FIELD_ID" --text "$type" || {
            echo "Error: Failed to set Type for item '$title'"
        }
    fi

    if [ -n "$complexity" ]; then
        gh project item-edit --project-id "$PROJECT_GLOBAL_ID" --id "$ITEM_ID" --field-id "$COMPLEXITY_FIELD_ID" --text "$complexity" || {
            echo "Error: Failed to set Complexity for item '$title'"
        }
    fi

    if [ -n "$time" ]; then
        gh project item-edit --project-id "$PROJECT_GLOBAL_ID" --id "$ITEM_ID" --field-id "$TIME_FIELD_ID" --text "$time" || {
            echo "Error: Failed to set EstimatedTime for item '$title'"
        }
    fi

    if [ -n "$deps" ]; then
        gh project item-edit --project-id "$PROJECT_GLOBAL_ID" --id "$ITEM_ID" --field-id "$DEPS_FIELD_ID" --text "$deps" || {
            echo "Error: Failed to set Dependencies for item '$title'"
        }
    fi

done < <(tail -n +2 "$TSV_PATH")
