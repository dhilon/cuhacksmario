import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame13: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(13));
    onWinRef.current = () => markLevelComplete(13);

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
        let bouncyPlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let ceilingSpikes: Phaser.GameObjects.Graphics;
        let spikeZones: { x: number; width: number }[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let lastBouncedPlatform: Phaser.Physics.Arcade.Sprite | null = null;
        let consecutiveBounces = 0;

        // WASD keys
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;

        // Down key hold tracking for bounce reduction
        let downHoldStartTime: number | null = null;

        // Bounce multipliers for different platform types
        const BOUNCE_WEAK = 0.75;      // Green - low bounce
        const BOUNCE_MEDIUM = 1.1;     // Yellow - medium bounce
        const BOUNCE_STRONG = 1.5;     // Red - high bounce
        const CONSECUTIVE_MULTIPLIER = 1.5; // 50% increase per consecutive bounce

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
                keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
                keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
                keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            }

            // Add background
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1200, 600);

            // Create ceiling spikes (75% coverage with gaps)
            ceilingSpikes = this.add.graphics();
            ceilingSpikes.setDepth(10);

            // Define spike zones (75% of ceiling covered)
            // Leave gaps at strategic locations for safe bouncing
            spikeZones = [
                { x: 0, width: 200 },      // Left section
                { x: 250, width: 150 },    //
                { x: 450, width: 200 },    // Middle-left
                { x: 700, width: 150 },    // Middle-right
                { x: 900, width: 200 },    // Right section (gap near flag)
            ];

            // Draw spikes
            ceilingSpikes.fillStyle(0xFF0000, 1);
            spikeZones.forEach(zone => {
                const spikeCount = Math.floor(zone.width / 20);
                for (let i = 0; i < spikeCount; i++) {
                    const spikeX = zone.x + i * 20 + 10;
                    // Draw triangle spike pointing down
                    ceilingSpikes.fillTriangle(
                        spikeX - 10, 0,
                        spikeX + 10, 0,
                        spikeX, 35
                    );
                }
            });

            // Add spike base
            ceilingSpikes.fillStyle(0x880000, 1);
            spikeZones.forEach(zone => {
                ceilingSpikes.fillRect(zone.x, 0, zone.width, 8);
            });

            // Create static platforms (regular)
            platforms = this.physics.add.staticGroup();

            // Starting platform (square block on left side)
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();

            // Flag platform (in a safe gap)
            const flagPlatform = platforms.create(1120, 80, 'ground').setScale(0.3, 0.15).refreshBody();
            flagPlatform.setTint(0x66FF66);

            // Create 16 bouncy platforms with varying bounce strengths
            // Green = weak, Yellow = medium, Red = strong
            // Size: 20x5 (2/5 of original 50x12)
            const bouncyConfigs = [
                { x: 110, y: 550, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 150, y: 520, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 280, y: 480, width: 20, height: 5, strength: BOUNCE_MEDIUM, color: 0xFFFF00 },
                { x: 400, y: 520, width: 20, height: 5, strength: BOUNCE_STRONG, color: 0xFF0000 },
                { x: 200, y: 420, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 500, y: 450, width: 20, height: 5, strength: BOUNCE_MEDIUM, color: 0xFFFF00 },
                { x: 350, y: 380, width: 20, height: 5, strength: BOUNCE_STRONG, color: 0xFF0000 },
                { x: 600, y: 380, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 450, y: 320, width: 20, height: 5, strength: BOUNCE_MEDIUM, color: 0xFFFF00 },
                { x: 700, y: 300, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 250, y: 280, width: 20, height: 5, strength: BOUNCE_STRONG, color: 0xFF0000 },
                { x: 550, y: 240, width: 20, height: 5, strength: BOUNCE_MEDIUM, color: 0xFFFF00 },
                { x: 800, y: 220, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
                { x: 650, y: 160, width: 20, height: 5, strength: BOUNCE_MEDIUM, color: 0xFFFF00 },
                { x: 900, y: 140, width: 20, height: 5, strength: BOUNCE_STRONG, color: 0xFF0000 },
                { x: 1000, y: 120, width: 20, height: 5, strength: BOUNCE_WEAK, color: 0x00FF00 },
            ];

            bouncyConfigs.forEach((config) => {
                // Create a bright filled rectangle as the visual
                const gfx = this.add.graphics();
                gfx.fillStyle(config.color, 1);
                gfx.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, 4);
                gfx.lineStyle(2, 0xFFFFFF, 1);
                gfx.strokeRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, 4);

                // Create invisible physics body for collision
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(0.06, 0.03);
                platform.setAlpha(0);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('isBouncy', true);
                platform.setData('graphics', gfx);
                platform.setData('baseY', config.y);
                platform.setData('width', config.width);
                platform.setData('height', config.height);
                platform.setData('strength', config.strength);
                platform.setData('baseColor', config.color);
                bouncyPlatforms.push(platform);
            });

            // Create flag (in safe zone)
            const flag = this.physics.add.sprite(1120, 60, 'flag').setScale(0.15);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player on starting block
            player = this.physics.add.sprite(50, 480, 'mario');
            player.setBounce(0.1);
            player.setCollideWorldBounds(true);
            // @ts-ignore
            (player.body as any).onWorldBounds = true;
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

            // Regular platform colliders
            this.physics.add.collider(player, platforms, () => {
                // Reset consecutive bounces when landing on regular platform
                if (player.body?.blocked.down) {
                    lastBouncedPlatform = null;
                    consecutiveBounces = 0;
                }
            });

            // Bouncy platform colliders with special bounce logic
            bouncyPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform, () => {
                    if (player.body && player.body.blocked.down) {
                        // Calculate consecutive bounce multiplier
                        if (lastBouncedPlatform === platform) {
                            consecutiveBounces++;
                        } else {
                            consecutiveBounces = 1;
                            lastBouncedPlatform = platform;
                        }

                        // Calculate down hold reduction (0.1 per 0.1 seconds = 1.0 per second)
                        let holdReduction = 0;
                        if (downHoldStartTime !== null) {
                            const holdDuration = (this.time.now - downHoldStartTime) / 1000; // in seconds
                            holdReduction = holdDuration; // 1.0 reduction per second held
                        }

                        const baseStrength = platform.getData('strength');
                        const reducedStrength = Math.max(0, baseStrength - holdReduction);
                        const consecutiveMultiplier = Math.pow(CONSECUTIVE_MULTIPLIER, consecutiveBounces - 1);
                        const finalBounce = -350 * reducedStrength * consecutiveMultiplier;

                        // Cap the maximum bounce to prevent insane heights
                        const cappedBounce = Math.max(finalBounce, -2000);
                        player.setVelocityY(cappedBounce);

                        // Reset hold time after bounce
                        downHoldStartTime = null;

                        // Visual feedback - flash brighter for consecutive bounces
                        const gfx = platform.getData('graphics');
                        const baseColor = platform.getData('baseColor');
                        if (gfx) {
                            // Flash white based on consecutive bounces
                            const flashIntensity = Math.min(consecutiveBounces * 0.3, 1);
                            this.tweens.add({
                                targets: gfx,
                                scaleY: 0.5,
                                duration: 100,
                                yoyo: true,
                                ease: 'Bounce.easeOut',
                            });
                        }

                        // Squash effect on Mario
                        this.tweens.add({
                            targets: player,
                            scaleY: 0.7,
                            scaleX: 1.3,
                            duration: 100,
                            yoyo: true,
                        });

                        // Show bounce multiplier text
                        if (consecutiveBounces > 1) {
                            const multiplierText = this.add.text(
                                platform.x,
                                platform.y - 30,
                                `x${consecutiveMultiplier.toFixed(1)}`,
                                { fontSize: '16px', color: '#ffffff', fontFamily: 'Arial' }
                            ).setOrigin(0.5, 0.5);

                            this.tweens.add({
                                targets: multiplierText,
                                y: platform.y - 60,
                                alpha: 0,
                                duration: 500,
                                onComplete: () => multiplierText.destroy()
                            });
                        }
                    }
                });
            });

            // Flag overlap
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
                    onWinRef.current();
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0x00ff00);
                    this.add.text(600, 300, 'You Won!', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            });

            // Death on hitting floor
            this.physics.world.on(
                'worldbounds',
                (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean) => {
                    if (body.gameObject === player && down) {
                        if (!player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setTint(0xB22222);
                            this.add.text(600, 300, 'Game Over', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);
                        }
                    }
                }
            );

            // Add hint text
            this.add.text(600, 580, 'Green=Low | Yellow=Med | Red=High. Hold DOWN to reduce bounce. No manual jump!', {
                fontSize: '14px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);
        }

        function update(this: Phaser.Scene) {
            if (!player.body || player.getData('hasWon')) return;

            // Check ceiling spike collision
            if (player.y < 40 && !player.getData('hasLost')) {
                const playerX = player.x;
                for (const zone of spikeZones) {
                    if (playerX >= zone.x && playerX <= zone.x + zone.width) {
                        // Hit spikes!
                        player.setData('hasLost', true);
                        player.setTint(0xB22222);
                        this.add.text(600, 300, 'Spiked!', {
                            fontSize: '48px',
                            color: '#ff0000',
                            fontFamily: 'Arial',
                        }).setOrigin(0.5, 0.5);
                        break;
                    }
                }
            }

            // Track down key hold for bounce reduction
            if (cursors) {
                const downPressed = cursors.down.isDown || keyS?.isDown;
                if (downPressed && downHoldStartTime === null) {
                    downHoldStartTime = this.time.now;
                } else if (!downPressed) {
                    downHoldStartTime = null;
                }
            }

            // Player movement (no up jump - only bouncy platforms provide jumps)
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
            }
        }

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div>
            <div className="background">
                <h1 className="text-container">AstroMario Game - Level 13</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 13: Trampoline Trouble</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game14')}>
                            <p className="p2">14th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame13;
