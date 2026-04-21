#!/bin/bash

SESSION_NAME="kolbo-dev"

# If already inside tmux: split current window and run
if [ -n "$TMUX" ]; then
    # Split current pane vertically
    tmux split-window -v
    
    # Run api in current (top) pane, web in new (bottom) pane
    tmux send-keys -t 0 'cd apps/api && npm run dev' C-m
    tmux send-keys -t 1 'cd apps/web && npm run dev' C-m
    
    # Select top pane
    tmux select-pane -t 0
    exit 0
fi

# Check if session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Attaching to existing $SESSION_NAME session"
    tmux attach -t $SESSION_NAME
    exit 0
fi

# Create new tmux session
tmux new-session -d -s $SESSION_NAME

# Split screen vertically
tmux split-window -v

# Run api dev server in top pane
tmux send-keys -t 0 'cd apps/api && npm run dev' C-m

# Run web dev server in bottom pane
tmux send-keys -t 1 'cd apps/web && npm run dev' C-m

# Select top pane by default
tmux select-pane -t 0

# Attach to session
tmux attach -t $SESSION_NAME
