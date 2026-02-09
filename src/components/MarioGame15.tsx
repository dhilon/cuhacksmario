import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame15: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(15));
    onWinRef.current = () => markLevelComplete(15);

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
                    gravity: { x: 0, y: 400 },
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
        let platforms: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let lava: Phaser.GameObjects.Rectangle;
        let lavaParticles: Phaser.GameObjects.Ellipse[] = [];

        // Flag collection system
        let flagsCollected = 0;
        const TOTAL_FLAGS = 5;
        let flagCounterText: Phaser.GameObjects.Text;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Lava state
        let lavaY = 650; // Start below screen
        const INITIAL_LAVA_SPEED = 15; // pixels per second
        const MAX_LAVA_SPEED = 60;
        const LAVA_ACCELERATION = 2; // Speed increase per second
        let currentLavaSpeed = INITIAL_LAVA_SPEED;
        let gameStartTime = 0;

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

            // Create platforms going upward (no floor - it will be consumed by lava)
            const platformConfigs = [
                // Starting area - square block
                { x: 50, y: 568, scaleX: 2, scaleY: 2 },
                { x: 200, y: 500, scaleX: 0.35, scaleY: 0.12 },
                { x: 500, y: 450, scaleX: 0.35, scaleY: 0.12 },
                { x: 200, y: 400, scaleX: 0.3, scaleY: 0.12 },
                { x: 700, y: 400, scaleX: 0.35, scaleY: 0.12 },

                // Middle section
                { x: 400, y: 350, scaleX: 0.35, scaleY: 0.12 },
                { x: 900, y: 350, scaleX: 0.35, scaleY: 0.12 },
                { x: 150, y: 300, scaleX: 0.3, scaleY: 0.12 },
                { x: 600, y: 280, scaleX: 0.35, scaleY: 0.12 },
                { x: 1050, y: 300, scaleX: 0.3, scaleY: 0.12 },

                // Upper section
                { x: 350, y: 230, scaleX: 0.35, scaleY: 0.12 },
                { x: 800, y: 220, scaleX: 0.35, scaleY: 0.12 },
                { x: 100, y: 180, scaleX: 0.3, scaleY: 0.12 },
                { x: 550, y: 160, scaleX: 0.35, scaleY: 0.12 },
                { x: 950, y: 150, scaleX: 0.3, scaleY: 0.12 },

                // Top section - flag area
                { x: 300, y: 100, scaleX: 0.3, scaleY: 0.12 },
                { x: 700, y: 80, scaleX: 0.35, scaleY: 0.12 },
            ];

            platformConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(config.scaleX, config.scaleY);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setTint(0x8B4513); // Brown tint
                platforms.push(platform);
            });

            // Create player on starting block (before flags so overlap works)
            player = this.physics.add.sprite(50, 480, 'mario');
            player.setBounce(0.1);
            player.setCollideWorldBounds(true);
            // @ts-ignore
            (player.body as any).onWorldBounds = true;
            player.setData('hasLost', false);
            player.setData('hasWon', false);

            // Create 5 flag platforms in different sections of the screen
            const flagConfigs = [
                { x: 100, y: 180, platformY: 200 },    // Top-left
                { x: 1100, y: 130, platformY: 150 },   // Top-right
                { x: 600, y: 260, platformY: 280 },    // Center
                { x: 200, y: 380, platformY: 400 },    // Left-middle
                { x: 1000, y: 330, platformY: 350 },   // Right-middle
            ];

            flagConfigs.forEach((config, index) => {
                // Flag platform
                const flagPlatform = this.physics.add.sprite(config.x, config.platformY, 'ground');
                flagPlatform.setScale(0.25, 0.12);
                (flagPlatform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (flagPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                flagPlatform.setTint(0x66FF66);
                platforms.push(flagPlatform);

                // Create flag
                const flag = this.physics.add.sprite(config.x, config.y, 'flag').setScale(0.12);
                flag.setOrigin(0.5, 1);
                (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                flag.setData('collected', false);
                flag.setData('index', index);

                // Flag overlap - collect flag
                this.physics.add.overlap(player, flag, () => {
                    if (!flag.getData('collected') && !player.getData('hasLost')) {
                        flag.setData('collected', true);
                        flagsCollected++;

                        // Visual feedback
                        flag.setAlpha(0.3);
                        flag.setTint(0x888888);
                        flagPlatform.setTint(0x888888);

                        // Update counter
                        flagCounterText.setText(`Flags: ${flagsCollected}/${TOTAL_FLAGS}`);

                        // Flash effect
                        this.cameras.main.flash(100, 0, 255, 0);

                        // Check if all flags collected
                        if (flagsCollected >= TOTAL_FLAGS && !player.getData('hasWon')) {
                            player.setData('hasWon', true);
                            onWinRef.current();
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0x00ff00);
                            this.add.text(600, 300, 'All Flags Collected! You Escaped!', {
                                fontSize: '36px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);
                        }
                    }
                });
            });

            // Create lava (starts below screen, tall enough to always fill bottom)
            lava = this.add.rectangle(600, lavaY, 1200, 800, 0xFF4500);
            lava.setOrigin(0.5, 0); // Origin at top center so lavaY is the top edge
            lava.setDepth(50);

            // Create lava surface effect (bubbles at the top)
            for (let i = 0; i < 20; i++) {
                const particle = this.add.ellipse(
                    Math.random() * 1200,
                    lavaY + Math.random() * 30,
                    20 + Math.random() * 30,
                    10 + Math.random() * 15,
                    0xFFFF00,
                    0.7
                );
                particle.setDepth(51);
                lavaParticles.push(particle);
            }

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

            // Platform colliders
            platforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Store game start time
            gameStartTime = this.time.now;

            // Add warning text
            this.add.text(600, 30, 'Collect all 5 flags before the lava rises!', {
                fontSize: '18px',
                color: '#ff4444',
                fontFamily: 'Arial',
                fontStyle: 'bold',
            }).setOrigin(0.5, 0.5).setDepth(100);

            // Add flag counter
            flagCounterText = this.add.text(1100, 30, `Flags: ${flagsCollected}/${TOTAL_FLAGS}`, {
                fontSize: '20px',
                color: '#00ff00',
                fontFamily: 'Arial',
                fontStyle: 'bold',
            }).setOrigin(0.5, 0.5).setDepth(100);
        }

        function update(this: Phaser.Scene) {
            if (!player.body) return;

            const delta = this.game.loop.delta / 1000; // Convert to seconds
            const currentTime = this.time.now;
            const elapsedTime = (currentTime - gameStartTime) / 1000; // seconds since start

            // Update lava speed (accelerates over time)
            currentLavaSpeed = Math.min(
                INITIAL_LAVA_SPEED + elapsedTime * LAVA_ACCELERATION,
                MAX_LAVA_SPEED
            );

            // Rise the lava
            if (!player.getData('hasLost') && !player.getData('hasWon')) {
                lavaY -= currentLavaSpeed * delta;
                lava.setY(lavaY);

                // Update lava particles (at the surface)
                lavaParticles.forEach((particle, i) => {
                    particle.setY(lavaY + Math.sin(currentTime / 200 + i) * 15);
                    particle.setX(particle.x + Math.sin(currentTime / 300 + i * 0.5) * 0.5);

                    // Wrap around
                    if (particle.x < -30) particle.setX(1230);
                    if (particle.x > 1230) particle.setX(-30);
                });

                // Check if player touched lava
                if (player.y + 20 > lavaY) {
                    player.setData('hasLost', true);
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0xB22222);
                    this.add.text(600, 300, 'Burned by Lava!', {
                        fontSize: '48px',
                        color: '#ff4444',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            }

            if (player.getData('hasLost') || player.getData('hasWon')) return;

            // Player movement
            if (cursors) {
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(-200);
                    player.anims.play('left', true);
                } else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(200);
                    player.anims.play('right', true);
                } else {
                    player.setVelocityX(0);
                }

                if ((cursors.up.isDown || keyW?.isDown) && player.body.blocked.down) {
                    player.setVelocityY(-420); // Higher jump for vertical level
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
                <h1 className="text-container">AstroMario Game - Level 15</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 15: Rising Inferno</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game16')}>
                            <p className="p2">16th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame15;
