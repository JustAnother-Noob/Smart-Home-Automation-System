#!/bin/bash

# Navigate to the Git repository
REPO_DIR="/home/no0ne/project"
cd "$REPO_DIR" || { echo "Error: Directory not found"; exit 1; }

# Detect the current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $BRANCH"

# Pull the latest changes from the remote repository
echo "Pulling latest changes from origin/$BRANCH..."
git pull origin "$BRANCH"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "You have uncommitted changes."

    # Ask for a commit message
    read -p "Enter a commit message: " COMMIT_MSG

    # Add all changes, commit, and push
    git add .
    git commit -m "$COMMIT_MSG"

    echo "Pushing changes to origin/$BRANCH..."
    git push origin "$BRANCH"
else
    echo "No changes to commit. Pull completed successfully."
fi
