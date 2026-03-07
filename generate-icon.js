const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIcon() {
    const iconSize = 512;
    const svg = `
    <svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#4f46e5" rx="100" />
      <path d="M180,200 L330,200 L330,350 L180,350 Z" fill="none" stroke="white" stroke-width="20" stroke-linejoin="round"/>
      <path d="M220,240 L290,240 M220,280 L290,280 M220,320 L270,320" stroke="white" stroke-width="15" stroke-linecap="round"/>
      <circle cx="255" cy="140" r="30" fill="white" />
    </svg>
  `;

    try {
        await sharp(Buffer.from(svg))
            .png()
            .toFile(path.join(__dirname, 'public', 'icon.png'));
        console.log('Icon generated successfully');
    } catch (error) {
        console.error('Error generating icon:', error);
    }
}

createIcon();
