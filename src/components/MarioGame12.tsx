import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame12: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(12));
    onWinRef.current = () => markLevelComplete(12);

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

        // Portal system - 20 portals with random pairings
        interface Portal {
            sprite: Phaser.GameObjects.Ellipse;
            innerSprite: Phaser.GameObjects.Ellipse;
            x: number;
            y: number;
            color: number;
            pairIndex: number; // Index of the paired portal
        }
        let portals: Portal[] = [];
        let lastPortalTime = 0;
        const PORTAL_COOLDOWN = 500;

        // Generate 20 unique colors
        function generateUniqueColors(count: number): number[] {
            const colors: number[] = [];
            for (let i = 0; i < count; i++) {
                const hue = (i * 360 / count) % 360;
                const saturation = 80 + Math.random() * 20;
                const lightness = 50 + Math.random() * 20;
                colors.push(hslToHex(hue, saturation, lightness));
            }
            return colors;
        }

        function hslToHex(h: number, s: number, l: number): number {
            s /= 100;
            l /= 100;
            const a = s * Math.min(l, 1 - l);
            const f = (n: number) => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color);
            };
            return (f(0) << 16) + (f(8) << 8) + f(4);
        }

        // Shuffle array (Fisher-Yates)
        function shuffleArray<T>(array: T[]): T[] {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

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

            // Starting platform (square block on left side) - doesn't crumble
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();

            // Flag platform (high up) - doesn't crumble
            platforms.create(1100, 80, 'ground').setScale(0.3, 0.15).refreshBody();

            // Crumbling platforms spread across level
            interface CrumblingPlatform {
                sprite: Phaser.Physics.Arcade.Sprite;
                touchTime: number | null;
                crumbling: boolean;
            }
            const crumblingPlatforms: CrumblingPlatform[] = [];

            const platformConfigs = [
                { x: 150, y: 480 }, { x: 300, y: 520 }, { x: 450, y: 450 },
                { x: 600, y: 380 }, { x: 750, y: 320 }, { x: 900, y: 400 },
                { x: 200, y: 350 }, { x: 400, y: 280 }, { x: 550, y: 200 },
                { x: 700, y: 150 }, { x: 850, y: 220 }, { x: 1000, y: 280 },
                { x: 1100, y: 180 }
            ];

            // Track spike zones for collision
            interface SpikeZone {
                x: number;
                y: number;
                width: number;
            }
            const spikeZones: SpikeZone[] = [];

            // Create spikes graphics
            const spikesGraphics = this.add.graphics();
            spikesGraphics.setDepth(5);

            platformConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(0.35, 0.12);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);

                crumblingPlatforms.push({
                    sprite: platform,
                    touchTime: null,
                    crumbling: false
                });

                // Draw spikes 70 pixels above platform (pointing UP)
                const spikeY = config.y - 70;
                const spikeWidth = 50;
                const spikeCount = 3;

                // Spike base at bottom
                spikesGraphics.fillStyle(0x880000, 1);
                spikesGraphics.fillRect(config.x - spikeWidth / 2, spikeY + 20, spikeWidth, 5);

                // Draw spike triangles pointing UP
                spikesGraphics.fillStyle(0xFF0000, 1);
                for (let i = 0; i < spikeCount; i++) {
                    const spikeX = config.x - spikeWidth / 2 + i * (spikeWidth / spikeCount) + (spikeWidth / spikeCount / 2);
                    spikesGraphics.fillTriangle(
                        spikeX - 8, spikeY + 20,
                        spikeX + 8, spikeY + 20,
                        spikeX, spikeY
                    );
                }

                // Track spike zone for collision (top of spikes)
                spikeZones.push({
                    x: config.x - spikeWidth / 2,
                    y: spikeY,
                    width: spikeWidth
                });
            });

            // Store spike zones for update
            this.data.set('spikeZones', spikeZones);

            // Generate 20 portal positions spread across the level
            const portalPositions = [
                { x: 120, y: 450 }, { x: 280, y: 490 }, { x: 420, y: 420 },
                { x: 570, y: 350 }, { x: 720, y: 290 }, { x: 870, y: 370 },
                { x: 170, y: 320 }, { x: 370, y: 250 }, { x: 520, y: 170 },
                { x: 670, y: 120 }, { x: 820, y: 190 }, { x: 970, y: 250 },
                { x: 1070, y: 150 }, { x: 250, y: 550 }, { x: 500, y: 550 },
                { x: 750, y: 550 }, { x: 950, y: 550 }, { x: 350, y: 380 },
                { x: 650, y: 480 }, { x: 1050, y: 350 }
            ];

            // Generate unique colors for all 20 portals
            const colors = generateUniqueColors(20);

            // Find two left-most and two right-most portals by x position
            const sortedByX = portalPositions.map((pos, idx) => ({ x: pos.x, idx }))
                .sort((a, b) => a.x - b.x);
            const leftMost = [sortedByX[0].idx, sortedByX[1].idx]; // indices 0, 6
            const rightMost = [sortedByX[18].idx, sortedByX[19].idx]; // indices 12, 19

            // Create random pairings ensuring left-most don't pair with right-most
            const pairings: number[] = new Array(20).fill(-1);

            // Separate portals into groups: left-most, right-most, and middle
            const middleIndices = [...Array(20).keys()].filter(
                i => !leftMost.includes(i) && !rightMost.includes(i)
            );

            // Shuffle each group
            const shuffledLeft = shuffleArray([...leftMost]);
            const shuffledRight = shuffleArray([...rightMost]);
            const shuffledMiddle = shuffleArray([...middleIndices]);

            // Pair left-most with random middle portals
            pairings[shuffledLeft[0]] = shuffledMiddle[0];
            pairings[shuffledMiddle[0]] = shuffledLeft[0];
            pairings[shuffledLeft[1]] = shuffledMiddle[1];
            pairings[shuffledMiddle[1]] = shuffledLeft[1];

            // Pair right-most with random middle portals
            pairings[shuffledRight[0]] = shuffledMiddle[2];
            pairings[shuffledMiddle[2]] = shuffledRight[0];
            pairings[shuffledRight[1]] = shuffledMiddle[3];
            pairings[shuffledMiddle[3]] = shuffledRight[1];

            // Pair remaining middle portals with each other
            const remainingMiddle = shuffledMiddle.slice(4);
            for (let i = 0; i < remainingMiddle.length; i += 2) {
                pairings[remainingMiddle[i]] = remainingMiddle[i + 1];
                pairings[remainingMiddle[i + 1]] = remainingMiddle[i];
            }

            // Create all 20 portals
            portalPositions.forEach((pos, index) => {
                const color = colors[index];

                // Create outer portal ellipse
                const sprite = this.add.ellipse(pos.x, pos.y, 35, 55, color, 0.7);
                sprite.setStrokeStyle(3, color);

                // Create inner rotating ellipse
                const innerSprite = this.add.ellipse(pos.x, pos.y, 18, 28, color, 0.9);

                // Add glow animation
                this.tweens.add({
                    targets: sprite,
                    alpha: { from: 0.5, to: 0.9 },
                    duration: 600 + Math.random() * 400,
                    yoyo: true,
                    repeat: -1,
                });

                // Add inner rotation effect
                this.tweens.add({
                    targets: innerSprite,
                    scaleX: { from: 0.7, to: 1.3 },
                    scaleY: { from: 1.3, to: 0.7 },
                    duration: 500 + Math.random() * 300,
                    yoyo: true,
                    repeat: -1,
                });

                portals.push({
                    sprite,
                    innerSprite,
                    x: pos.x,
                    y: pos.y,
                    color,
                    pairIndex: pairings[index]
                });
            });

            // Create flag
            const flag = this.physics.add.sprite(1100, 60, 'flag').setScale(0.15);
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

            // Colliders
            this.physics.add.collider(player, platforms);

            // Crumbling platform colliders
            crumblingPlatforms.forEach((cp) => {
                this.physics.add.collider(player, cp.sprite, () => {
                    // Start crumble timer when player lands on platform
                    if (player.body?.blocked.down && cp.touchTime === null && !cp.crumbling) {
                        cp.touchTime = this.time.now;

                        // Start shaking animation
                        this.tweens.add({
                            targets: cp.sprite,
                            x: cp.sprite.x + 2,
                            duration: 50,
                            yoyo: true,
                            repeat: -1
                        });
                    }
                });
            });

            // Store crumbling platforms reference for update
            this.data.set('crumblingPlatforms', crumblingPlatforms);

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
                            player.setVelocity(0, 0);
                            player.anims.stop();
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
            this.add.text(600, 30, 'Portals are random! Platforms crumble after 4 seconds!', {
                fontSize: '16px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);
        }

        function update(this: Phaser.Scene) {
            if (!player.body || player.getData('hasLost') || player.getData('hasWon')) return;

            const currentTime = this.time.now;

            // Check portal collisions
            if (currentTime - lastPortalTime > PORTAL_COOLDOWN) {
                for (let i = 0; i < portals.length; i++) {
                    const portal = portals[i];
                    const dx = player.x - portal.x;
                    const dy = player.y - portal.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 22) {
                        const pairedPortal = portals[portal.pairIndex];

                        if (pairedPortal) {
                            // Store current velocity
                            const velX = player.body?.velocity.x || 0;
                            const velY = player.body?.velocity.y || 0;

                            // Teleport player
                            player.setPosition(pairedPortal.x, pairedPortal.y);

                            // Maintain momentum (with slight boost)
                            player.setVelocity(velX * 1.1, velY * 1.1);

                            lastPortalTime = currentTime;

                            // Visual feedback
                            this.cameras.main.flash(100, 255, 255, 255, false);
                            break;
                        }
                    }
                }
            }

            // Check spike collisions (only from above - falling onto spikes)
            const spikeZones = this.data.get('spikeZones') as Array<{
                x: number;
                y: number;
                width: number;
            }>;

            if (spikeZones && player.body) {
                const playerX = player.x;
                const playerY = player.y + 20; // Bottom of player
                const playerVelY = player.body.velocity.y;

                for (const zone of spikeZones) {
                    // Only trigger if falling down (velY > 0) and hitting top of spikes
                    if (playerVelY > 0 &&
                        playerX >= zone.x && playerX <= zone.x + zone.width &&
                        playerY >= zone.y && playerY <= zone.y + 15) {
                        // Hit spikes from above!
                        player.setData('hasLost', true);
                        player.setVelocity(0, 0);
                        player.anims.stop();
                        player.setTint(0xB22222);
                        this.add.text(600, 300, 'Spiked!', {
                            fontSize: '48px',
                            color: '#ff0000',
                            fontFamily: 'Arial',
                        }).setOrigin(0.5, 0.5);
                        return;
                    }
                }
            }

            // Check crumbling platforms
            const crumblingPlatforms = this.data.get('crumblingPlatforms') as Array<{
                sprite: Phaser.Physics.Arcade.Sprite;
                touchTime: number | null;
                crumbling: boolean;
            }>;

            if (crumblingPlatforms) {
                crumblingPlatforms.forEach((cp) => {
                    if (cp.touchTime !== null && !cp.crumbling) {
                        // Check if 4 seconds have passed
                        if (currentTime - cp.touchTime >= 4000) {
                            cp.crumbling = true;

                            // Crumble animation and destroy
                            this.tweens.add({
                                targets: cp.sprite,
                                alpha: 0,
                                scaleY: 0,
                                duration: 300,
                                onComplete: () => {
                                    cp.sprite.destroy();
                                }
                            });
                        }
                    }
                });
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
                <h1 className="text-container">AstroMario Game - Level 12</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 12: Portal Maze</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game13')}>
                            <p className="p2">13th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame12;
