#!/bin/bash

PORT=5001
PIDS=$(lsof -ti :$PORT)

if [ -z "$PIDS" ]; then
    echo "No process found running on port $PORT"
else
    echo "Killing processes on port $PORT: $PIDS"
    kill -9 $PIDS
    echo "Processes killed."
fi
