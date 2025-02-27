# HCalculator

A modern Windows calculator with memory functionality, persistent history, and customizable preferences built with Electron.

## Features

- Basic arithmetic operations (addition, subtraction, multiplication, division)
- Advanced memory functionality (MS, MR, M+, M-, MC, and multiple stored values)
- Persistent calculation history that survives app restarts
- Delete individual history items
- Dark/Light theme switching
- Customizable settings (thousands separator, always on top)
- Zoom functionality (Ctrl + scroll wheel)
- Beautiful modern UI inspired by Windows 11 design
- Elegant animations and visual feedback
- History panel that can be toggled on/off or pinned
- Keyboard support for faster calculations
- Persistent window position and size
- Copy and paste support

## Keyboard Shortcuts

- **0-9**: Input numbers
- **+, -, *, /**: Operators
- **Enter/=**: Calculate result
- **ESC**: Clear calculator
- **Backspace**: Delete last digit
- **H**: Toggle history panel
- **S**: Toggle settings panel
- **Alt+C**: Memory Clear
- **Alt+R**: Memory Recall
- **Alt+P**: Memory Add (plus)
- **Alt+M**: Memory Subtract (minus)
- **Alt+S**: Memory Store
- **Alt+D**: Show Memory Dropdown
- **Ctrl+C**: Copy display value
- **Ctrl+V**: Paste into display
- **Alt+Enter**: Show context menu

## Getting Started

### Prerequisites

- Node.js (14.x or later)
- npm (6.x or later)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/adamosk/HCalculator.git
   cd HCalculator
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

### Building for Production

To create a production build for Windows:

```
npm run dist
```

The packaged application will be available in the `dist` folder.

## Technology Stack

- Electron.js
- HTML/CSS/JavaScript
- electron-store for data persistence
- Material Icons for UI elements

## License

This project is licensed under the MIT License. 