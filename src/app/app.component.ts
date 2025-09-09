import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DataColumn {
  x: number;
  z: number; // Depth coordinate
  characters: Array<{
    char: string;
    y: number;
    alpha: number;
    hue: number;
    isActive: boolean;
    lastChange: number;
    changeInterval: number;
    isPartOfWord: boolean;
    wordIndex?: number;
  }>;
  speed: number;
  lastUpdate: number;
  fontSize: number;
  currentWord?: string;
  wordStartIndex?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="matrix-container">
      <canvas class="matrix-canvas"></canvas>
      
      <!-- Login Form Overlay -->
      <div class="login-overlay">
        <div class="login-form">
          <div class="form-header">
            <h2>MATRIX ACCESS</h2>
            <p>Enter security code to proceed</p>
          </div>
          
          <div class="input-group">
            <input 
              type="password" 
              placeholder="Security Code" 
              [(ngModel)]="securityCode"
              (keyup.enter)="authenticate()"
              class="security-input"
              autocomplete="off"
            />
          </div>
          
          <button 
            class="liquid-glass-button" 
            (click)="authenticate()"
            [disabled]="!securityCode"
          >
            <span class="button-text">ENTER MATRIX</span>
            <div class="liquid-effect"></div>
          </button>
          
          <div class="form-footer">
            <small>Authorized personnel only</small>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'data-flow-landing';
  securityCode: string = '';
  isAuthenticated: boolean = false;
  
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private columns: DataColumn[] = [];
  private animationId!: number;
  private mouse = { x: 0, y: 0 };
  private lastFrameTime = 0;
  private targetFPS = 60;
  private frameInterval = 1000 / this.targetFPS;
  private cameraZ = 0; // Camera position for perspective
  private readonly maxDepth = 2000; // Maximum depth of field
  private readonly minDepth = -300; // Closest depth to camera
  private readonly regenerationBuffer = 500; // Extra distance ahead for regeneration
  
  private readonly dataChars = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z',
    '{', '}', '[', ']', '(', ')', '<', '>', '|', '\\',
    '/', '*', '+', '-', '=', '^', '&', '%', '$', '#'
  ];

  private readonly meaningfulWords = [
    'DATA', 'FLOW', 'CODE', 'JSON', 'API', 'HTTP', 'SQL', 'CSS',
    'HTML', 'NODE', 'REACT', 'VUE', 'AJAX', 'REST', 'TCP', 'UDP',
    'CACHE', 'ASYNC', 'AWAIT', 'FUNC', 'VARS', 'CONST', 'LET',
    'CLASS', 'OBJECT', 'ARRAY', 'STRING', 'INT', 'FLOAT', 'BOOL',
    'NULL', 'TRUE', 'FALSE', 'VOID', 'RETURN', 'IF', 'ELSE',
    'FOR', 'WHILE', 'SWITCH', 'CASE', 'TRY', 'CATCH', 'THROW',
    'IMPORT', 'EXPORT', 'MODULE', 'PACKAGE', 'BUNDLE', 'BUILD',
    'DEBUG', 'ERROR', 'WARN', 'INFO', 'LOG', 'TRACE', 'STACK',
    'HEAP', 'MEMORY', 'CPU', 'GPU', 'RAM', 'DISK', 'CACHE',
    'THREAD', 'PROCESS', 'TASK', 'QUEUE', 'STACK', 'LIST',
    'HASH', 'MAP', 'SET', 'TREE', 'GRAPH', 'NODE', 'EDGE',
    'ALGORITHM', 'SORT', 'SEARCH', 'BINARY', 'LINEAR', 'O(N)',
    'DATABASE', 'TABLE', 'INDEX', 'QUERY', 'JOIN', 'WHERE',
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
    'CLOUD', 'AWS', 'AZURE', 'GCP', 'DOCKER', 'K8S', 'NGINX',
    'REDIS', 'MONGO', 'MYSQL', 'POSTGRES', 'ELASTIC', 'KAFKA'
  ];

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.initParticleAnimation();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  authenticate() {
    // Simple demo authentication - in real app would be more secure
    if (this.securityCode.toLowerCase() === 'matrix' || 
        this.securityCode === '2077' || 
        this.securityCode.toLowerCase() === 'neo') {
      this.isAuthenticated = true;
      // Hide the form with animation
      const overlay = document.querySelector('.login-overlay') as HTMLElement;
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 500);
      }
    } else {
      // Show error effect
      const input = document.querySelector('.security-input') as HTMLElement;
      if (input) {
        input.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          input.style.animation = '';
        }, 500);
      }
      this.securityCode = '';
    }
  }

  private initParticleAnimation() {
    this.canvas = this.elementRef.nativeElement.querySelector('.matrix-canvas');
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d')!;
    this.setupCanvas();
    this.createDataColumns();
    this.animate();
    this.addEventListeners();
  }

  private setupCanvas() {
    const updateSize = () => {
      const container = this.canvas.parentElement;
      if (container) {
        this.canvas.width = container.offsetWidth;
        this.canvas.height = container.offsetHeight;
        this.createDataColumns(); // Recreate columns when size changes
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
  }

  private createDataColumns() {
    this.columns = [];
    const baseColumnWidth = 20; // Wider spacing to prevent overlap
    const columnsPerRow = Math.floor(this.canvas.width / baseColumnWidth);
    const totalColumns = columnsPerRow * 4; // More columns for better density
    
    // Create more columns distributed across entire depth field
    for (let i = 0; i < totalColumns; i++) {
      const x = (i % columnsPerRow) * baseColumnWidth + (baseColumnWidth / 2);
      const column = this.createColumn(x);
      // Distribute columns evenly ahead of camera for continuous flow
      column.z = this.cameraZ + Math.random() * (this.maxDepth + this.regenerationBuffer);
      this.columns.push(column);
    }
  }

  private createColumn(x: number): DataColumn {
    const charactersPerColumn = 12 + Math.floor(Math.random() * 8); // 12-20 characters (reduced)
    const characters = [];
    const now = Date.now();
    const startDelay = Math.random() * 5000; // Stagger column starts
    
    for (let i = 0; i < charactersPerColumn; i++) {
      const irregularSpacing = 25 + Math.random() * 15; // 25-40px spacing for better spread
      characters.push({
        char: this.getRandomChar(),
        y: Math.random() * this.canvas.height, // Distribute randomly across full screen height
        alpha: Math.random() * 0.8 + 0.2, // Start with some visibility
        hue: Math.random() * 60 + 120,
        isActive: Math.random() < 0.25,
        lastChange: now + startDelay,
        changeInterval: 500 + Math.random() * 1000, // 500-1500ms intervals (slower)
        isPartOfWord: false,
        wordIndex: undefined
      });
    }
    
    const column: DataColumn = {
      x,
      z: Math.random() * this.maxDepth, // Random depth
      characters,
      speed: 0.8 + Math.random() * 2.2, // More varied speeds
      lastUpdate: now + startDelay,
      fontSize: 13 + Math.random() * 4 // More font size variation
    };
    
    // Random chance to have a meaningful word (less frequent)
    if (Math.random() < 0.15) {
      setTimeout(() => {
        this.assignWordToColumn(column);
      }, Math.random() * 3000); // Delayed word assignment
    }
    
    return column;
  }

  private regenerateColumn(column: DataColumn) {
    const now = Date.now();
    
    // Reset column properties
    column.speed = 0.8 + Math.random() * 2.2;
    column.fontSize = 13 + Math.random() * 4;
    column.lastUpdate = now;
    column.currentWord = undefined;
    column.wordStartIndex = undefined;
    
    // Regenerate all characters
    column.characters.forEach(char => {
      char.y = Math.random() * this.canvas.height; // Full screen distribution
      char.alpha = Math.random() * 0.8 + 0.2; // Immediate visibility
      char.hue = Math.random() * 60 + 120; // Green spectrum
      char.isActive = Math.random() < 0.25;
      char.char = this.getRandomChar();
      char.lastChange = now + Math.random() * 1000; // Staggered changes
      char.changeInterval = 500 + Math.random() * 1000;
      char.isPartOfWord = false;
      char.wordIndex = undefined;
    });
    
    // Random chance for meaningful word
    if (Math.random() < 0.15) {
      setTimeout(() => {
        this.assignWordToColumn(column);
      }, Math.random() * 2000);
    }
  }

  private getRandomChar(): string {
    return this.dataChars[Math.floor(Math.random() * this.dataChars.length)];
  }

  private getRandomWord(): string {
    return this.meaningfulWords[Math.floor(Math.random() * this.meaningfulWords.length)];
  }

  private assignWordToColumn(column: DataColumn) {
    const word = this.getRandomWord();
    const startIndex = Math.floor(Math.random() * (column.characters.length - word.length - 2));
    
    column.currentWord = word;
    column.wordStartIndex = startIndex;
    
    for (let i = 0; i < word.length; i++) {
      const charIndex = startIndex + i;
      if (charIndex < column.characters.length) {
        column.characters[charIndex].char = word[i];
        column.characters[charIndex].isPartOfWord = true;
        column.characters[charIndex].wordIndex = i;
        column.characters[charIndex].isActive = true;
        column.characters[charIndex].hue = 180 + Math.random() * 60; // Cyan-blue for words
      }
    }
  }

  private updateDataColumns() {
    const now = Date.now();
    
    // Move camera forward through the data at constant speed
    this.cameraZ += 2.5; // Steady forward movement
    
    this.columns.forEach(column => {
      // Move column towards camera at same speed as camera to maintain relative position
      // This creates the illusion of infinite depth
      column.z -= 2.5; // Same speed as camera movement
      
      // Regenerate columns that pass behind camera to maintain infinite effect
      if (column.z < this.cameraZ - 100) { // Move behind camera with some buffer
        // Move to far ahead of camera for continuous flow
        column.z = this.cameraZ + this.maxDepth + Math.random() * this.regenerationBuffer;
        
        // Regenerate the entire column for fresh appearance
        this.regenerateColumn(column);
      }
      
      // Update character positions and morphing
      column.characters.forEach((char, index) => {
        char.y += column.speed;
        
        // Cycle colors smoothly
        char.hue = (char.hue + 0.2) % 360;
        
        // Character morphing for non-word characters (slower and less frequent)
        if (!char.isPartOfWord && now - char.lastChange > char.changeInterval) {
          char.char = this.getRandomChar();
          char.lastChange = now;
          char.changeInterval = 500 + Math.random() * 1000; // Slower morphing
          
          // Sometimes become active when changing
          if (Math.random() < 0.3) {
            char.isActive = !char.isActive;
          }
        }
        
        // Calculate alpha based on position and activity
        const screenPosition = char.y / this.canvas.height;
        
        if (char.isActive) {
          // Active characters are always bright
          char.alpha = Math.max(0.7, 1 - screenPosition * 0.5);
        } else {
          // Inactive characters are still visible
          char.alpha = Math.max(0.4, (1 - screenPosition * 0.5) * 0.7);
        }
        
        // Reset character if it goes off screen - cycle back to top
        if (char.y > this.canvas.height + 50) {
          char.y = -Math.random() * 50; // Start just above screen
          
          // Reset word properties
          char.isPartOfWord = false;
          char.wordIndex = undefined;
          
          char.char = this.getRandomChar();
          char.hue = Math.random() * 60 + (120 + Math.sin(now * 0.001) * 60);
          char.isActive = Math.random() < 0.4;
          char.alpha = Math.random() * 0.8 + 0.2; // Ensure visibility
          char.lastChange = now + Math.random() * 1000; // Stagger resets
          char.changeInterval = 500 + Math.random() * 1000; // Consistent slower intervals
        }
      });
      
      // Less frequent and more irregular character activation
      if (now - column.lastUpdate > 800 + Math.random() * 1200) { // Slower activation changes
        const randomChar = column.characters[Math.floor(Math.random() * column.characters.length)];
        if (!randomChar.isPartOfWord && Math.random() < 0.7) { // More selective activation
          randomChar.isActive = !randomChar.isActive;
        }
        column.lastUpdate = now;
      }
      
      // Occasionally assign new words when current word goes off screen
      if (column.currentWord && column.wordStartIndex !== undefined) {
        const wordEndChar = column.characters[column.wordStartIndex + column.currentWord.length - 1];
        if (wordEndChar && wordEndChar.y > this.canvas.height + 50) {
          // Word has scrolled off screen, reset
          column.currentWord = undefined;
          column.wordStartIndex = undefined;
          
          // 15% chance to assign a new word
          if (Math.random() < 0.15) {
            this.assignWordToColumn(column);
          }
        }
      } else {
        // No current word, less frequent word assignment
        if (Math.random() < 0.05) { // Reduced from 0.1 to 0.05
          this.assignWordToColumn(column);
        }
      }
    });
    
    // Mouse interaction - activate nearby characters (accounting for perspective)
    this.columns.forEach(column => {
      const perspective = 800;
      const distance = column.z - this.cameraZ;
      
      if (distance > 0 && distance <= this.maxDepth + this.regenerationBuffer) {
        const scale = perspective / distance;
        const perspectiveX = (column.x - this.canvas.width / 2) * scale + this.canvas.width / 2;
        
        if (Math.abs(perspectiveX - this.mouse.x) < 50 * scale) {
          column.characters.forEach(char => {
            const perspectiveY = (char.y - this.canvas.height / 2) * scale + this.canvas.height / 2;
            if (Math.abs(perspectiveY - this.mouse.y) < 100 * scale) {
              char.isActive = true;
              char.hue = (char.hue + 5) % 360;
            }
          });
        }
      }
    });
  }

  private drawDataColumns() {
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Sort columns by depth (far to near) for proper rendering
    const sortedColumns = [...this.columns].sort((a, b) => b.z - a.z);
    
    sortedColumns.forEach(column => {
      // Calculate perspective scaling
      const perspective = 800; // Perspective strength
      let distance = column.z - this.cameraZ;
      
      // Skip if column is behind camera or too far
      if (distance <= 0) return;
      if (distance > this.maxDepth + this.regenerationBuffer) return;
      
      const scale = perspective / distance;
      const perspectiveX = (column.x - this.canvas.width / 2) * scale + this.canvas.width / 2;
      
      // Improved depth-based alpha - smoother fade with distance
      const normalizedDistance = distance / this.maxDepth;
      const depthAlpha = Math.max(0.15, 1 - normalizedDistance * 0.7); // Smoother fade
      const scaledFontSize = Math.max(6, column.fontSize * scale);
      
      this.ctx.font = `${scaledFontSize}px "Monaco", "Menlo", "Ubuntu Mono", monospace`;
      
      column.characters.forEach(char => {
        const combinedAlpha = char.alpha * depthAlpha;
        
        if (combinedAlpha > 0.01) { // Draw more characters
          const perspectiveY = (char.y - this.canvas.height / 2) * scale + this.canvas.height / 2;
          
          const hue = char.hue;
          const saturation = char.isActive ? 80 : 50;
          const lightness = char.isActive ? 75 : 60;
          
          // No glow or shadow effects
          this.ctx.shadowBlur = 0;
          
          this.ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${combinedAlpha})`;
          this.ctx.fillText(char.char, perspectiveX, perspectiveY);
        }
      });
    });
    
    // No shadows used anymore
  }

  private animate(currentTime = 0) {
    // Frame rate limiting
    if (currentTime - this.lastFrameTime < this.frameInterval) {
      this.animationId = requestAnimationFrame((time) => this.animate(time));
      return;
    }
    
    this.lastFrameTime = currentTime;
    
    // Clear canvas completely - no trails or effects
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.updateDataColumns();
    this.drawDataColumns();
    
    this.animationId = requestAnimationFrame((time) => this.animate(time));
  }

  private addEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Activate characters in a radius around click (accounting for perspective)
      this.columns.forEach(column => {
        const perspective = 800;
        const distance = column.z - this.cameraZ;
        
        if (distance > 0 && distance <= this.maxDepth + this.regenerationBuffer) {
          const scale = perspective / distance;
          const perspectiveX = (column.x - this.canvas.width / 2) * scale + this.canvas.width / 2;
          
          if (Math.abs(perspectiveX - x) < 100 * scale) {
            column.characters.forEach(char => {
              const perspectiveY = (char.y - this.canvas.height / 2) * scale + this.canvas.height / 2;
              if (Math.abs(perspectiveY - y) < 150 * scale) {
                char.isActive = true;
                char.hue = Math.random() * 360; // Random rainbow color on click
              }
            });
          }
        }
      });
    });
  }
}