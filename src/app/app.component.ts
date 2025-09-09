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

    private readonly japaneseChars = [
        '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
        '人', '大', '小', '中', '上', '下', '左', '右', '前', '後',
        '日', '月', '火', '水', '木', '金', '土', '年', '時', '分',
        '山', '川', '海', '空', '風', '雨', '雪', '雲', '星', '光',
        '心', '手', '目', '耳', '口', '足', '体', '頭', '顔', '声',
        '家', '門', '窓', '道', '橋', '車', '電', '火', '水',
        '食', '飲', '見', '聞', '話', '読', '書', '学', '教', '習',
        '行', '来', '帰', '出', '入', '立', '座', '寝', '起', '歩',
        '走', '飛', '泳', '歌', '踊', '笑', '泣', '怒', '喜', '悲',
        '愛', '友', '親', '子', '兄', '姉', '弟', '妹', '夫', '妻',
        '男', '女', '父', '母', '爺', '婆', '孫',
        '赤', '青', '黄', '緑', '白', '黒', '茶', '紫',
        '春', '夏', '秋', '冬', '朝', '昼', '夕', '夜', '今', '昔',
        '新', '古', '高', '低', '長', '短', '広', '狭', '深', '浅',
        '速', '遅', '早', '多', '少', '重', '軽', '強', '弱',
        '美', '醜', '善', '悪', '正', '邪', '真', '偽', '明', '暗',
        '始', '終', '開', '閉', '生', '死',
        '和', '平', '戦', '争', '勝', '負', '得', '失', '成', '敗',
        '力', '気', '神', '仏', '天', '地', '東', '西', '南', '北',
        '花', '鳥', '魚', '虫', '木', '草', '石', '金', '銀', '銅',
        '音', '色', '形', '味', '香', '触', '感', '思', '想', '夢',
        '希', '望', '願', '祈', '信', '念', '志', '意', '情', '緒',
        '楽', '苦', '辛', '甘', '酸', '辛', '熱', '冷', '温', '涼',
        '静', '動', '安', '危', '平', '険', '易', '難', '簡', '複',
        '直', '曲', '正', '斜', '横', '縦', '内', '外', '表', '裏',
        '先', '後', '初', '終', '始', '末', '頭', '尾', '上', '下',
        '前', '後', '左', '右', '中', '間', '近', '遠', '早', '遅',
        '新', '旧', '古', '若', '老', '少', '多', '少', '大', '小',
        '高', '低', '深', '浅', '長', '短', '広', '狭', '厚', '薄',
        '重', '軽', '強', '弱', '硬', '軟', '固', '液', '気', '体',
        '明', '暗', '光', '影', '白', '黒', '赤', '青', '黄', '緑'
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
        'REDIS', 'MONGO', 'MYSQL', 'POSTGRES', 'ELASTIC', 'KAFKA',
        'MATRIX', 'NEO', 'AGENT', 'SMITH', 'MORPHEUS', 'TRINITY',
        'CYPHER', 'TANK', 'MOUSE', 'APOC', 'SWITCH', 'KEYMAKER',
        'ARCHITECT', 'ORACLE', 'SERAPH', 'MEROVINGIAN', 'PERSOPHONE',
        'NIOBE', 'GHOST', 'TRAINMAN', 'RAMA', 'LINK', 'BANE',
        'VIRUS', 'WORM', 'TROJAN', 'MALWARE', 'FIREWALL', 'ENCRYPT',
        'DECRYPT', 'HASH', 'TOKEN', 'AUTH', 'JWT', 'OAUTH',
        'SSL', 'TLS', 'HTTPS', 'DNS', 'IP', 'MAC', 'UUID',
        'BASE64', 'HEX', 'BINARY', 'OCTAL', 'ASCII', 'UTF8',
        'REGEX', 'PARSE', 'VALIDATE', 'SANITIZE', 'ESCAPE', 'ENCODE',
        'DECODE', 'COMPRESS', 'DECOMPRESS', 'ARCHIVE', 'EXTRACT', 'MERGE',
        'SPLIT', 'CONCAT', 'SUBSTRING', 'REPLACE', 'SEARCH', 'FIND',
        'INDEX', 'SORT', 'FILTER', 'MAP', 'REDUCE', 'FOREACH',
        'PROMISE', 'CALLBACK', 'EVENT', 'EMIT', 'LISTEN', 'BIND',
        'CLONE', 'COPY', 'DEEP', 'SHALLOW', 'REFERENCE', 'VALUE',
        'MUTABLE', 'IMMUTABLE', 'PURE', 'SIDE', 'EFFECT', 'STATE',
        'PROPS', 'HOOKS', 'CONTEXT', 'PROVIDER', 'CONSUMER', 'REDUCER',
        'ACTION', 'DISPATCH', 'STORE', 'SELECTOR', 'MIDDLEWARE', 'THUNK',
        'SAGA', 'EPIC', 'OBSERVABLE', 'STREAM', 'SUBJECT', 'OPERATOR'
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
        const baseColumnWidth = 25; // Reduced spacing for denser animation
        const columnsPerRow = Math.floor(this.canvas.width / baseColumnWidth);
        const totalColumns = columnsPerRow * 3; // Increased for more columns

        for (let i = 0; i < totalColumns; i++) {
            const x = (i % columnsPerRow) * baseColumnWidth + (baseColumnWidth / 2);
            const column = this.createColumn(x);
            column.z = this.cameraZ + Math.random() * (this.maxDepth + this.regenerationBuffer);
            this.columns.push(column);
        }

        this.columns.sort((a, b) => a.x - b.x);
    }

    private createColumn(x: number): DataColumn {
        const charactersPerColumn = 60 + Math.floor(Math.random() * 30);
        const characters = [];
        const now = Date.now();
        const startDelay = Math.random() * 2000;

        for (let i = 0; i < charactersPerColumn; i++) {
            const extendedHeight = this.canvas.height * 2.2;
            const baseSpacing = extendedHeight / charactersPerColumn;
            const randomOffset = (Math.random() - 0.5) * baseSpacing * 0.2;
            const y = (i * baseSpacing) + randomOffset - (extendedHeight * 0.3);

            characters.push({
                char: this.getRandomChar(),
                y: y,
                alpha: Math.random() * 0.8 + 0.2,
                hue: Math.random() * 60 + 120,
                isActive: Math.random() < 0.25,
                lastChange: now + startDelay,
                changeInterval: 500 + Math.random() * 1000,
                isPartOfWord: false,
                wordIndex: undefined
            });
        }

        const column: DataColumn = {
            x,
            z: Math.random() * this.maxDepth,
            characters,
            speed: 0.8 + Math.random() * 2.2,
            lastUpdate: now + startDelay,
            fontSize: 13 + Math.random() * 4
        };

        if (Math.random() < 0.15) {
            setTimeout(() => {
                this.assignWordToColumn(column);
            }, Math.random() * 3000);
        }

        return column;
    }

    private regenerateColumn(column: DataColumn) {
        const now = Date.now();

        column.speed = 0.8 + Math.random() * 2.2;
        column.fontSize = 13 + Math.random() * 4;
        column.lastUpdate = now;
        column.currentWord = undefined;
        column.wordStartIndex = undefined;

        column.characters.forEach((char, index) => {
            const extendedHeight = this.canvas.height * 2.2;
            const baseSpacing = extendedHeight / column.characters.length;
            const randomOffset = (Math.random() - 0.5) * baseSpacing * 0.2;
            char.y = (index * baseSpacing) + randomOffset - (extendedHeight * 0.3);

            char.alpha = 0.4 + Math.random() * 0.4;
            char.hue = Math.random() * 60 + 120;
            char.isActive = Math.random() < 0.15;
            char.char = this.getRandomChar();
            char.lastChange = now + Math.random() * 3000;
            char.changeInterval = 3000 + Math.random() * 4000;
            char.isPartOfWord = false;
            char.wordIndex = undefined;
        });

        if (Math.random() < 0.12) {
            setTimeout(() => {
                this.assignWordToColumn(column);
            }, Math.random() * 2000);
        }
    }

    private getRandomChar(): string {
        const useJapanese = Math.random() < 0.7;
        if (useJapanese) {
            return this.japaneseChars[Math.floor(Math.random() * this.japaneseChars.length)];
        } else {
            return this.dataChars[Math.floor(Math.random() * this.dataChars.length)];
        }
    }

    private getRandomWord(): string {
        return this.meaningfulWords[Math.floor(Math.random() * this.meaningfulWords.length)];
    }

    private hasWordInRange(column: DataColumn, startIndex: number, endIndex: number): boolean {
        for (let i = startIndex; i <= endIndex && i < column.characters.length; i++) {
            if (column.characters[i].isPartOfWord) {
                return true;
            }
        }
        return false;
    }

    private findSafeWordPosition(column: DataColumn, wordLength: number): number | null {
        const maxAttempts = 10;
        const minSpacing = 3;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const startIndex = Math.floor(Math.random() * (column.characters.length - wordLength - 2));
            const endIndex = startIndex + wordLength - 1;

            const safeStart = Math.max(0, startIndex - minSpacing);
            const safeEnd = Math.min(column.characters.length - 1, endIndex + minSpacing);

            if (!this.hasWordInRange(column, safeStart, safeEnd)) {
                return startIndex;
            }
        }

        return null;
    }

    private assignWordToColumn(column: DataColumn) {
        const word = this.getRandomWord();

        const startIndex = this.findSafeWordPosition(column, word.length);

        if (startIndex === null) {
            return;
        }

        column.currentWord = word;
        column.wordStartIndex = startIndex;

        for (let i = 0; i < word.length; i++) {
            const charIndex = startIndex + i;
            if (charIndex < column.characters.length) {
                const char = column.characters[charIndex];
                char.char = word[i];
                char.isPartOfWord = true;
                char.wordIndex = i;
                char.isActive = true;
                char.hue = 160 + Math.random() * 80;
                char.lastChange = Date.now();
                char.changeInterval = 999999;
            }
        }
    }

    private updateDataColumns() {
        const now = Date.now();

        this.cameraZ += 2.0; // Reduced camera speed for smoother trails

        this.columns.forEach(column => {
            column.z -= 2.0;

            if (column.z < this.cameraZ - 100) {
                column.z = this.cameraZ + this.maxDepth + Math.random() * this.regenerationBuffer;
                this.regenerateColumn(column);
            }

            column.characters.forEach((char, index) => {
                char.y += column.speed;

                if (now % 3 === 0 && !char.isPartOfWord) {
                    char.hue = (char.hue + 0.1) % 360;
                }

                if (!char.isPartOfWord && now - char.lastChange > char.changeInterval) {
                    char.char = this.getRandomChar();
                    char.lastChange = now;
                    char.changeInterval = 2000 + Math.random() * 3000;

                    if (Math.random() < 0.1) {
                        char.isActive = !char.isActive;
                    }
                } else if (char.isPartOfWord) {
                    char.lastChange = now;
                    char.isActive = true;
                }

                const screenPosition = char.y / this.canvas.height;
                if (char.isPartOfWord) {
                    char.alpha = Math.max(0.8, 1 - screenPosition * 0.2);
                } else {
                    char.alpha = char.isActive ?
                        Math.max(0.6, 1 - screenPosition * 0.4) :
                        Math.max(0.3, (1 - screenPosition * 0.4) * 0.6);
                }

                if (char.y > this.canvas.height + 200) {
                    char.y = -Math.random() * 300;

                    if (!char.isPartOfWord) {
                        char.char = this.getRandomChar();
                        char.hue = Math.random() * 60 + 120;
                        char.isActive = Math.random() < 0.3;
                        char.alpha = 0.5 + Math.random() * 0.3;
                        char.lastChange = now + Math.random() * 2000;
                        char.changeInterval = 2000 + Math.random() * 3000;
                    }
                }
            });

            if (now - column.lastUpdate > 5000 + Math.random() * 5000) {
                const randomChar = column.characters[Math.floor(Math.random() * column.characters.length)];
                if (!randomChar.isPartOfWord && Math.random() < 0.3) {
                    randomChar.isActive = !randomChar.isActive;
                }
                column.lastUpdate = now;
            }

            if (column.currentWord && column.wordStartIndex !== undefined) {
                const wordEndChar = column.characters[column.wordStartIndex + column.currentWord.length - 1];
                if (wordEndChar && wordEndChar.y > this.canvas.height + 200) {
                    column.currentWord = undefined;
                    column.wordStartIndex = undefined;

                    if (Math.random() < 0.20) {
                        this.assignWordToColumn(column);
                    }
                }
            } else {
                if (Math.random() < 0.08) {
                    this.assignWordToColumn(column);
                }
            }
        });

        if (now % 2 === 0) {
            this.columns.forEach(column => {
                const perspective = 800;
                const distance = column.z - this.cameraZ;

                if (distance > 0 && distance <= this.maxDepth + this.regenerationBuffer) {
                    const scale = perspective / distance;
                    const perspectiveX = (column.x - this.canvas.width / 2) * scale + this.canvas.width / 2;

                    if (Math.abs(perspectiveX - this.mouse.x) < 60 * scale) {
                        column.characters.forEach(char => {
                            const perspectiveY = (char.y - this.canvas.height / 2) * scale + this.canvas.height / 2;
                            if (Math.abs(perspectiveY - this.mouse.y) < 120 * scale) {
                                if (!char.isPartOfWord) {
                                    char.isActive = true;
                                    char.hue = (char.hue + 3) % 360;
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    private drawDataColumns() {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const sortedColumns = [...this.columns].sort((a, b) => b.z - a.z);

        sortedColumns.forEach(column => {
            const perspective = 800;
            let distance = column.z - this.cameraZ;

            if (distance <= 0 || distance > this.maxDepth + this.regenerationBuffer) return;

            const scale = perspective / distance;
            const perspectiveX = (column.x - this.canvas.width / 2) * scale + this.canvas.width / 2;

            const depthAlpha = Math.pow(1 - (distance / this.maxDepth), 2);
            const scaledFontSize = Math.max(8, column.fontSize * scale);

            this.ctx.font = `${scaledFontSize}px "Monaco", "Menlo", "Ubuntu Mono", monospace`;

            column.characters.forEach((char, index) => {
                const combinedAlpha = char.alpha * Math.max(0.2, depthAlpha);

                if (combinedAlpha > 0.15) {
                    const perspectiveY = (char.y - this.canvas.height / 2) * scale + this.canvas.height / 2;

                    if (perspectiveY < -30 || perspectiveY > this.canvas.height + 30) return;

                    let saturation, lightness, hue = char.hue;
                    const isHead = index === 0; // Top character is the "head" for dripping effect

                    if (char.isPartOfWord) {
                        saturation = 90;
                        lightness = 80;
                    } else if (char.isActive) {
                        saturation = 70;
                        lightness = 70;
                    } else {
                        saturation = 40;
                        lightness = 50;
                    }

                    // Dripping drop effect: Make the head character white and glowing
                    if (isHead && !char.isPartOfWord) {
                        this.ctx.fillStyle = `rgba(255, 255, 255, ${combinedAlpha})`;
                        this.ctx.shadowBlur = 10;
                        this.ctx.shadowColor = `rgba(255, 255, 255, ${combinedAlpha * 0.7})`;
                    } else {
                        this.ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${combinedAlpha})`;
                        if (char.isPartOfWord || char.isActive) {
                            this.ctx.shadowBlur = 5;
                            this.ctx.shadowColor = `hsla(${hue}, 100%, 50%, ${combinedAlpha * 0.5})`;
                        } else {
                            this.ctx.shadowBlur = 0;
                        }
                    }

                    this.ctx.fillText(char.char, perspectiveX, perspectiveY);

                    // Reset shadow
                    this.ctx.shadowBlur = 0;
                }
            });
        });
    }

    private animate(currentTime = 0) {
        if (currentTime - this.lastFrameTime < this.frameInterval) {
            this.animationId = requestAnimationFrame((time) => this.animate(time));
            return;
        }

        this.lastFrameTime = currentTime;

        // Full clear to remove trails
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
                                if (!char.isPartOfWord) {
                                    char.isActive = true;
                                    char.hue = Math.random() * 360;
                                }
                                char.alpha = Math.min(1, char.alpha + 0.3);
                                setTimeout(() => { char.alpha = Math.max(0.3, char.alpha - 0.3); }, 500);
                            }
                        });
                    }
                }
            });
        });
    }
}