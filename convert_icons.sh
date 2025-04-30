#!/bin/bash

# Install ImageMagick if not already installed
if ! command -v magick &> /dev/null; then
    echo "Installing ImageMagick..."
    brew install imagemagick
fi

# Clear potential caching
magick cache:clear

# Convert SVG to PNG in different sizes
magick icons/icon.svg -background none -resize 16x16 icons/icon16.png
magick icons/icon.svg -background none -resize 32x32 icons/icon32.png
magick icons/icon.svg -background none -resize 48x48 icons/icon48.png
magick icons/icon.svg -background none -resize 128x128 icons/icon128.png

echo "Icons created successfully!" 