const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

// Path to PNG files directory
const pngDir = 'E:\\Users\\adamosk\\Downloads\\hcalculator-logo';
// Output path for ICO file
const outPath = path.join(__dirname, 'assets', 'hcalculator-logo.ico');

// Get all PNG files from the directory
const pngFiles = fs.readdirSync(pngDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .map(file => path.join(pngDir, file));

if (pngFiles.length === 0) {
    console.error('No PNG files found in the directory!');
    process.exit(1);
}

console.log(`Found ${pngFiles.length} PNG files to convert`);
pngFiles.forEach(file => console.log(`- ${file}`));

// Convert PNG files to ICO
pngToIco(pngFiles)
    .then(buf => {
        // Ensure the assets directory exists
        if (!fs.existsSync(path.join(__dirname, 'assets'))) {
            fs.mkdirSync(path.join(__dirname, 'assets'), { recursive: true });
        }
        
        // Write the ICO file
        fs.writeFileSync(outPath, buf);
        console.log(`Successfully created ICO file at: ${outPath}`);
    })
    .catch(err => {
        console.error('Error creating ICO file:', err);
    }); 