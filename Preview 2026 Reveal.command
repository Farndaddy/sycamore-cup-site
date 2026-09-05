#!/bin/bash
cd ~/Library/CloudStorage/OneDrive-Personal/00\ Claude/Sycamore-Cup-Site
python3 -m http.server 8642 > /dev/null 2>&1 &
SERVER_PID=$!
sleep 1
open "http://localhost:8642/reveal-2026.html"
echo "Reveal page is running at http://localhost:8642/reveal-2026.html"
echo "Leave this window open while you're previewing it."
echo ""
echo "Press any key to stop the preview and close..."
read -n 1
kill $SERVER_PID
