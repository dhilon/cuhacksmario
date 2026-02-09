import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame16: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(16));
    onWinRef.current = () => markLevelComplete(16);

    // R key to reload
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                window.location.reload();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 1200,
            height: 600,
            parent: gameContainerRef.current,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { x: 0, y: 300 },
                    debug: false,
                },
            },
            scene: {
                preload: preload,
                create: create,
                update: update,
            },
        };

        const game = new Phaser.Game(config);

        let player: Phaser.Physics.Arcade.Sprite;
        let platforms: Phaser.Physics.Arcade.StaticGroup;
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Symbols and colors (10 symbols) - all white
        const SYMBOLS = ['★', '☾', '☀', '♦', '♠', '♥', '◆', '●', '▲', '■'];
        const SYMBOL_COLORS = [0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF];

        // Sequence game state
        interface SymbolPlatform {
            platform: Phaser.Physics.Arcade.Sprite;
            symbolText: Phaser.GameObjects.Text;
            symbolIndex: number;
            x: number;
            y: number;
        }
        let symbolPlatforms: SymbolPlatform[] = [];
        let sequence: number[] = []; // The order player must follow (indices into symbolPlatforms)
        let currentStep = 0; // Which step in the sequence we're showing/expecting
        let playerProgress = 0; // How many correct platforms player has hit
        let isShowingSequence = false;
        let gameStarted = false;
        let sequenceDisplay: Phaser.GameObjects.Text[] = [];
        let progressText: Phaser.GameObjects.Text;
        let headerText: Phaser.GameObjects.Text;
        let timerText: Phaser.GameObjects.Text;
        let roundStartTime = 0;
        let currentRound = 1;
        let roundTimeLimit = 0; // 4 * sqrt(n) seconds
        let roundInProgress = false;
        let currentStepInRound = 0; // Which symbol in the current round we're expecting
        let lastPlatformIndex = -1; // Track which platform Mario is on to allow re-landing

        function preload(this: Phaser.Scene) {
            this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
            this.load.image('ground', 'https://labs.phaser.io/assets/platforms/grass-tile.png');
            this.load.image('flag', '/flag.png');
            this.load.spritesheet('mario', '/mario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('imario', '/imario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
        }

        function create(this: Phaser.Scene) {
            this.game.canvas.setAttribute('tabindex', '0');
            this.game.canvas.focus();

            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
                cursors = this.input.keyboard.createCursorKeys();
                keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
                keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
                keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            }

            // Add background
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1200, 600);

            // Create static platforms
            platforms = this.physics.add.staticGroup();

            // Starting platform (square block on left side)
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();

            // Block on right side to hop up
            platforms.create(1150, 568, 'ground').setScale(2).refreshBody();

            // Floor so Mario can land (5 platforms under bottom symbols)
            platforms.create(150, 590, 'ground').setScale(0.4, 0.1).refreshBody();
            platforms.create(350, 590, 'ground').setScale(0.4, 0.1).refreshBody();
            platforms.create(550, 590, 'ground').setScale(0.4, 0.1).refreshBody();
            platforms.create(750, 590, 'ground').setScale(0.4, 0.1).refreshBody();
            platforms.create(950, 590, 'ground').setScale(0.4, 0.1).refreshBody();

            // Navigation platforms under symbol platforms
            platforms.create(150, 480, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(350, 480, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(450, 480, 'ground').setScale(0.3, 0.15).refreshBody(); // Between 2nd and 3rd
            platforms.create(550, 480, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(750, 480, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(850, 480, 'ground').setScale(0.3, 0.15).refreshBody(); // Between 4th and 5th
            platforms.create(950, 480, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(250, 320, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(450, 320, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(650, 320, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(850, 320, 'ground').setScale(0.3, 0.15).refreshBody();
            platforms.create(1050, 320, 'ground').setScale(0.3, 0.15).refreshBody();

            // Generate random sequence (10 unique platform indices)
            const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
            sequence = shuffleArray(indices);

            // Create 10 symbol platforms with fixed symbols (5 bottom, 5 top)
            const platformConfigs = [
                { x: 150, y: 450 },
                { x: 350, y: 450 },
                { x: 550, y: 450 },
                { x: 750, y: 450 },
                { x: 950, y: 450 },
                { x: 250, y: 290 },
                { x: 450, y: 290 },
                { x: 650, y: 290 },
                { x: 850, y: 290 },
                { x: 1050, y: 290 },
            ];

            platformConfigs.forEach((config, index) => {
                // Symbol platform
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(0.15, 0.1);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setTint(SYMBOL_COLORS[index]);

                // Fixed symbol text on platform
                const symbolText = this.add.text(config.x, config.y - 30, SYMBOLS[index], {
                    fontSize: '32px',
                    color: '#' + SYMBOL_COLORS[index].toString(16).padStart(6, '0'),
                    fontFamily: 'Arial',
                }).setOrigin(0.5, 0.5);

                symbolPlatforms.push({
                    platform,
                    symbolText,
                    symbolIndex: index,
                    x: config.x,
                    y: config.y,
                });
            });

            // Header text
            headerText = this.add.text(600, 40, 'Watch the sequence!', {
                fontSize: '24px',
                color: '#ffcc00',
                fontFamily: 'Arial',
                fontStyle: 'bold',
            }).setOrigin(0.5, 0.5);

            // Sequence display area (flashing symbols overhead) - 10 symbols
            for (let i = 0; i < 10; i++) {
                const displayText = this.add.text(180 + i * 85, 90, '', {
                    fontSize: '32px',
                    color: '#ffffff',
                    fontFamily: 'Arial',
                }).setOrigin(0.5, 0.5);
                sequenceDisplay.push(displayText);
            }

            // Progress text
            progressText = this.add.text(500, 130, 'Progress: 0/10', {
                fontSize: '20px',
                color: '#00ff00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);

            // Timer text
            timerText = this.add.text(750, 130, 'Time: --', {
                fontSize: '20px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);

            // Create player on starting block
            player = this.physics.add.sprite(50, 480, 'mario');
            player.setBounce(0.1);
            player.setCollideWorldBounds(true);
            player.setData('hasLost', false);
            player.setData('hasWon', false);

            // Player animations
            this.anims.create({
                key: 'left',
                frames: this.anims.generateFrameNumbers('imario', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1,
            });

            this.anims.create({
                key: 'right',
                frames: this.anims.generateFrameNumbers('mario', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1,
            });

            // Colliders
            this.physics.add.collider(player, platforms);

            // Symbol platform colliders - check sequence
            symbolPlatforms.forEach((sp, index) => {
                this.physics.add.collider(player, sp.platform, () => {
                    if (!gameStarted || isShowingSequence || player.getData('hasLost') || player.getData('hasWon')) return;

                    if (player.body?.blocked.down) {
                        // Only register if this is a different platform than last time (allows staying/jumping off)
                        if (index === lastPlatformIndex) return;
                        lastPlatformIndex = index;

                        // Check if this is the correct platform in current step of round
                        const expectedPlatformIndex = sequence[currentStepInRound];

                        if (index === expectedPlatformIndex) {
                            // Correct!
                            currentStepInRound++;

                            // Flash platform green
                            sp.platform.setTint(0x00FF00);
                            this.time.delayedCall(200, () => {
                                sp.platform.setTint(SYMBOL_COLORS[sp.symbolIndex]);
                            });

                            // Check if completed current round (got all symbols 1 through currentRound)
                            if (currentStepInRound >= currentRound) {
                                // Round complete!
                                playerProgress++;
                                progressText.setText(`Progress: ${playerProgress}/10`);

                                // Check if completed all 10 rounds
                                if (playerProgress >= 10) {
                                    roundInProgress = false;
                                    player.setData('hasWon', true);
                                    onWinRef.current();
                                    player.setVelocity(0, 0);
                                    player.anims.stop();
                                    player.setTint(0x00ff00);
                                    headerText.setText('PERFECT! YOU WIN!');
                                    headerText.setColor('#00ff00');
                                    timerText.setText('DONE!');
                                    timerText.setColor('#00ff00');
                                    this.cameras.main.flash(500, 0, 255, 0);
                                    this.add.text(600, 300, 'Sequence Complete!', {
                                        fontSize: '48px',
                                        color: '#00ff00',
                                        fontFamily: 'Arial',
                                    }).setOrigin(0.5, 0.5);
                                } else {
                                    // Stop current timer and show next sequence
                                    roundInProgress = false;
                                    showSequence(this, playerProgress + 1);
                                }
                            }
                        } else {
                            // Wrong! Explode!
                            roundInProgress = false;
                            player.setData('hasLost', true);
                            player.setTint(0xFF0000);

                            // Explosion effect
                            this.cameras.main.shake(300, 0.02);
                            this.cameras.main.flash(300, 255, 0, 0);

                            // Create explosion particles
                            for (let i = 0; i < 20; i++) {
                                const particle = this.add.circle(
                                    player.x + (Math.random() - 0.5) * 60,
                                    player.y + (Math.random() - 0.5) * 60,
                                    5 + Math.random() * 10,
                                    0xFF4400
                                );
                                this.tweens.add({
                                    targets: particle,
                                    alpha: 0,
                                    scale: 2,
                                    duration: 500,
                                    onComplete: () => particle.destroy()
                                });
                            }

                            // Reveal the correct sequence
                            for (let i = 0; i < currentRound; i++) {
                                const platformIndex = sequence[i];
                                const sp = symbolPlatforms[platformIndex];
                                sequenceDisplay[i].setText(SYMBOLS[sp.symbolIndex]);
                                sequenceDisplay[i].setColor('#ffffff');
                            }
                            headerText.setText('The correct sequence was:');
                            headerText.setColor('#ff6666');

                            this.add.text(600, 300, 'WRONG! BOOM!', {
                                fontSize: '48px',
                                color: '#ff0000',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);
                        }
                    }
                });
            });

            // Add hint text
            this.add.text(600, 570, 'Watch the flashing sequence, then hop on platforms in order!', {
                fontSize: '14px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);

            // Start showing sequence after a short delay
            this.time.delayedCall(1000, () => {
                showSequence(this, 1);
            });
        }

        function shuffleArray<T>(array: T[]): T[] {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function showSequence(scene: Phaser.Scene, count: number) {
            isShowingSequence = true;
            roundInProgress = false;
            currentRound = count;
            currentStepInRound = 0; // Reset step counter for new round
            lastPlatformIndex = -1; // Reset platform tracking
            headerText.setText(`Memorize: ${count} symbol${count > 1 ? 's' : ''}!`);
            headerText.setColor('#ff4444');
            timerText.setText('Time: --');
            timerText.setColor('#ffcc00');

            // Clear display
            sequenceDisplay.forEach(text => text.setText(''));

            // Flash sequence one by one
            let flashIndex = 0;
            const flashInterval = scene.time.addEvent({
                delay: 600,
                callback: () => {
                    if (flashIndex < count) {
                        const platformIndex = sequence[flashIndex];
                        const sp = symbolPlatforms[platformIndex];

                        // Show in overhead display (white for visibility)
                        sequenceDisplay[flashIndex].setText(SYMBOLS[sp.symbolIndex]);
                        sequenceDisplay[flashIndex].setColor('#ffffff');

                        // Flash the platform
                        sp.platform.setTint(0xFFFFFF);
                        sp.symbolText.setScale(1.5);
                        scene.time.delayedCall(300, () => {
                            sp.platform.setTint(SYMBOL_COLORS[sp.symbolIndex]);
                            sp.symbolText.setScale(1);
                        });

                        flashIndex++;
                    } else {
                        // Done showing sequence
                        flashInterval.destroy();

                        // Keep symbols visible for a moment, then hide and start timer
                        scene.time.delayedCall(1000, () => {
                            sequenceDisplay.forEach(text => {
                                text.setText('?');
                                text.setColor('#666666');
                            });
                            headerText.setText('GO! Hit the platforms in order!');
                            headerText.setColor('#00ff00');
                            isShowingSequence = false;
                            gameStarted = true;

                            // Start round timer: 4 * sqrt(n) seconds
                            roundTimeLimit = 4 * Math.sqrt(count);
                            roundStartTime = scene.time.now;
                            roundInProgress = true;
                        });
                    }
                },
                repeat: count
            });
        }

        function update(this: Phaser.Scene) {
            if (!player.body || player.getData('hasWon')) return;

            const hasLost = player.getData('hasLost');

            // Reset platform tracking when not on any symbol platform (skip if lost)
            if (!hasLost && player.body.blocked.down) {
                let onSymbolPlatform = false;
                for (let i = 0; i < symbolPlatforms.length; i++) {
                    const sp = symbolPlatforms[i];
                    const dx = Math.abs(player.x - sp.x);
                    const dy = Math.abs(player.y - sp.y);
                    if (dx < 30 && dy < 40) {
                        onSymbolPlatform = true;
                        break;
                    }
                }
                if (!onSymbolPlatform) {
                    lastPlatformIndex = -1;
                }
            }

            // Check round timer (skip if lost)
            if (!hasLost && roundInProgress && !isShowingSequence) {
                const elapsed = (this.time.now - roundStartTime) / 1000;
                const remaining = roundTimeLimit - elapsed;

                if (remaining <= 0) {
                    // Time's up! Explode!
                    roundInProgress = false;
                    player.setData('hasLost', true);
                    player.setTint(0xFF0000);

                    // Explosion effect
                    this.cameras.main.shake(300, 0.02);
                    this.cameras.main.flash(300, 255, 0, 0);

                    // Create explosion particles
                    for (let i = 0; i < 20; i++) {
                        const particle = this.add.circle(
                            player.x + (Math.random() - 0.5) * 60,
                            player.y + (Math.random() - 0.5) * 60,
                            5 + Math.random() * 10,
                            0xFF4400
                        );
                        this.tweens.add({
                            targets: particle,
                            alpha: 0,
                            scale: 2,
                            duration: 500,
                            onComplete: () => particle.destroy()
                        });
                    }

                    // Reveal the correct sequence
                    for (let i = 0; i < currentRound; i++) {
                        const platformIndex = sequence[i];
                        const sp = symbolPlatforms[platformIndex];
                        sequenceDisplay[i].setText(SYMBOLS[sp.symbolIndex]);
                        sequenceDisplay[i].setColor('#ffffff');
                    }
                    headerText.setText('The correct sequence was:');
                    headerText.setColor('#ff6666');

                    timerText.setText('TIME UP!');
                    timerText.setColor('#ff0000');
                    this.add.text(600, 300, 'TOO SLOW! BOOM!', {
                        fontSize: '48px',
                        color: '#ff0000',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                } else {
                    // Update timer display
                    timerText.setText(`Time: ${remaining.toFixed(1)}s`);
                    if (remaining < 2) {
                        timerText.setColor('#ff0000');
                    } else if (remaining < 4) {
                        timerText.setColor('#ffaa00');
                    } else {
                        timerText.setColor('#00ff00');
                    }
                }
            }

            // Player movement
            if (cursors) {
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(-180);
                    player.anims.play('left', true);
                } else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(180);
                    player.anims.play('right', true);
                } else {
                    player.setVelocityX(0);
                }

                if ((cursors.up.isDown || keyW?.isDown) && player.body.blocked.down) {
                    player.setVelocityY(-350);
                }
            }
        }

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div>
            <div className="background">
                <h1 className="text-container">AstroMario Game - Level 16</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 16: Simon Says</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game17')}>
                            <p className="p2">17th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame16;
