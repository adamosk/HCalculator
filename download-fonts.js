const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsToDownload = [
  {
    url: 'https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
    dest: 'assets/fonts/MaterialIcons-Regular.woff2'
  },
  {
    url: 'https://fonts.gstatic.com/s/materialiconsoutlined/v109/gok-H7zzDkdnRel8-DQ6KAXJ69wP1tGnf4ZGhUce.woff2',
    dest: 'assets/fonts/MaterialIconsOutlined-Regular.woff2'
  }
];

// Make sure the directory exists
const fontsDir = path.join(__dirname, 'assets/fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Download function
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(dest, () => {}); // Delete the file if there was an error
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
}

// Download all fonts
async function downloadFonts() {
  console.log('Downloading Material Icons fonts...');
  
  const promises = fontsToDownload.map(({ url, dest }) => {
    return downloadFile(url, dest);
  });
  
  try {
    await Promise.all(promises);
    console.log('All fonts downloaded successfully!');
  } catch (error) {
    console.error('Error downloading fonts:', error);
    process.exit(1);
  }
}

// Run the download
downloadFonts(); 