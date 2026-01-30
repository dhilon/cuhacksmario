import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame8: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);

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
        let crumblingPlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let checkpoint: Phaser.GameObjects.Text | undefined;
        let sceneRef: Phaser.Scene;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        function preload(this: Phaser.Scene) {
            // Load assets
            this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
            this.load.image('ground', 'https://labs.phaser.io/assets/platforms/grass-tile.png');
            this.load.image('star', 'https://labs.phaser.io/assets/sprites/star.png');
            this.load.image('flag', '/flag.png');
            this.load.spritesheet('mario', '/mario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('imario', '/imario.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
            this.load.spritesheet('goomba', '/goomba.png', {
                frameWidth: 40,
                frameHeight: 40,
            });
        }

        function create(this: Phaser.Scene) {
            sceneRef = this;

            // Focus the game canvas
            this.game.canvas.setAttribute('tabindex', '0');
            this.game.canvas.focus();

            // Enable keyboard input
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
                cursors = this.input.keyboard.createCursorKeys();
                // WASD keys
                keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
                keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
                keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
                keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            } else {
                console.warn('Keyboard input not available.');
            }

            // Add background (stretched to fit)
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1200, 600);

            // Create static platforms
            platforms = this.physics.add.staticGroup();

            // Create start platform that crumbles after 7 seconds
            const startPlatform = this.physics.add.sprite(600, 568, 'ground').setScale(3);
            (startPlatform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            (startPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(true);

            // Create crumbling platforms - staircase pattern going right then left
            // Added two flag platforms in top corners
            const platformConfigs = [
                { x: 150, y: 480, standTime: 900, respawnTime: 5000 },
                { x: 350, y: 440, standTime: 700, respawnTime: 4000 },
                { x: 580, y: 400, standTime: 800, respawnTime: 5000 },
                { x: 820, y: 450, standTime: 600, respawnTime: 4500 },
                { x: 1050, y: 400, standTime: 750, respawnTime: 3500 },
                { x: 1150, y: 340, standTime: 850, respawnTime: 5000 },
                { x: 920, y: 300, standTime: 650, respawnTime: 4000 },
                { x: 680, y: 260, standTime: 800, respawnTime: 4500 },
                { x: 450, y: 300, standTime: 700, respawnTime: 5000 },
                { x: 200, y: 250, standTime: 550, respawnTime: 4000 },
                { x: 80, y: 190, standTime: 900, respawnTime: 4500 },
                { x: 300, y: 140, standTime: 650, respawnTime: 5000 },
                { x: 550, y: 160, standTime: 750, respawnTime: 4000 },
                { x: 30, y: 60, standTime: 1200, respawnTime: 6000 },  // Top left flag platform
                { x: 1170, y: 60, standTime: 1200, respawnTime: 6000 }, // Top right flag platform
            ];

            platformConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.12);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('originalX', config.x);
                platform.setData('originalY', config.y);
                platform.setData('standTime', config.standTime);
                platform.setData('respawnTime', config.respawnTime);
                platform.setData('playerStandingTime', 0);
                platform.setData('isCrumbling', false);
                platform.setData('hasFallen', false);
                platform.setTint(0xFFAA66); // Orange tint to indicate crumbling
                crumblingPlatforms.push(platform);
            });

            // Create two flags - one in each top corner bordering the edges
            const flagLeft = this.physics.add.sprite(30, 40, 'flag').setScale(0.15);
            flagLeft.setOrigin(0.5, 1);
            (flagLeft.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            const flagRight = this.physics.add.sprite(1170, 40, 'flag').setScale(0.15);
            flagRight.setOrigin(0.5, 1);
            (flagRight.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player
            player = this.physics.add.sprite(600, 500, 'mario');
            player.setBounce(0.2);
            player.setCollideWorldBounds(true);
            // @ts-ignore: onWorldBounds is read-only in TS definitions
            (player.body as any).onWorldBounds = true;
            player.setData('hasLost', false);
            player.setData('hasWon', false);
            player.setData('flagLeftCollected', false);
            player.setData('flagRightCollected', false);

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

            // Collider: player vs. static platforms
            this.physics.add.collider(player, platforms);

            // Collider: player vs. start platform
            this.physics.add.collider(player, startPlatform);

            // Schedule start platform to crumble after 7 seconds
            this.time.delayedCall(7000, () => {
                startPlatform.setTint(0xFF4444);
                (startPlatform.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                (startPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(false);

                this.tweens.add({
                    targets: startPlatform,
                    alpha: 0,
                    rotation: 0.3,
                    duration: 800,
                    onComplete: () => {
                        (startPlatform.body as Phaser.Physics.Arcade.Body).enable = false;
                    }
                });
            });

            // Collider: player vs. crumbling platforms
            crumblingPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Overlap: player vs. left flag
            this.physics.add.overlap(player, flagLeft, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon') && !player.getData('flagLeftCollected')) {
                    player.setData('flagLeftCollected', true);
                    flagLeft.setTint(0x00ff00); // Turn green when collected
                    flagLeft.setAlpha(0.5);

                    // Check if both flags collected
                    if (player.getData('flagRightCollected')) {
                        player.setData('hasWon', true);
                        player.setVelocity(0, 0);
                        player.anims.stop();
                        player.setTint(0x00ff00);
                        this.add
                            .text(600, 300, 'You won!', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            })
                            .setOrigin(0.5, 0.5);
                    } else {
                        // Show message to get the other flag
                        const msg = this.add
                            .text(600, 300, 'Now get the other flag!', {
                                fontSize: '36px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            })
                            .setOrigin(0.5, 0.5);
                        this.time.delayedCall(3000, () => {
                            msg.destroy();
                        });
                    }
                }
            });

            // Overlap: player vs. right flag
            this.physics.add.overlap(player, flagRight, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon') && !player.getData('flagRightCollected')) {
                    player.setData('flagRightCollected', true);
                    flagRight.setTint(0x00ff00); // Turn green when collected
                    flagRight.setAlpha(0.5);

                    // Check if both flags collected
                    if (player.getData('flagLeftCollected')) {
                        player.setData('hasWon', true);
                        player.setVelocity(0, 0);
                        player.anims.stop();
                        player.setTint(0x00ff00);
                        this.add
                            .text(600, 300, 'You won!', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            })
                            .setOrigin(0.5, 0.5);
                    } else {
                        // Show message to get the other flag
                        const msg = this.add
                            .text(600, 300, 'Now get the other flag!', {
                                fontSize: '36px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            })
                            .setOrigin(0.5, 0.5);
                        this.time.delayedCall(3000, () => {
                            msg.destroy();
                        });
                    }
                }
            });

            // Listen for world-bounds collisions
            this.physics.world.on(
                'worldbounds',
                (
                    body: Phaser.Physics.Arcade.Body,
                    up: boolean,
                    down: boolean,
                    left: boolean,
                    right: boolean
                ) => {
                    // Only care if Mario hit the bottom edge
                    if (body.gameObject === player && down) {
                        if (!player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0xb22222);
                            checkpoint?.destroy();
                            checkpoint = undefined;
                            this.add
                                .text(600, 300, 'Game Over', {
                                    fontSize: '48px',
                                    color: '#ffffff',
                                    fontFamily: 'Arial',
                                })
                                .setOrigin(0.5, 0.5);
                        }
                    }
                }
            );
        }

        function isPlayerOnPlatform(platform: Phaser.Physics.Arcade.Sprite): boolean {
            if (!player.body || !platform.body || !(platform.body as Phaser.Physics.Arcade.Body).enable) return false;

            const playerBounds = player.getBounds();
            const platformBounds = platform.getBounds();

            // Check if player is blocked down and horizontally overlapping with platform
            const horizontalOverlap = playerBounds.right > platformBounds.left &&
                                      playerBounds.left < platformBounds.right;
            const verticalTouch = Math.abs(playerBounds.bottom - platformBounds.top) < 15;

            return player.body.blocked.down && horizontalOverlap && verticalTouch;
        }

        function respawnPlatform(platform: Phaser.Physics.Arcade.Sprite) {
            const originalX = platform.getData('originalX');
            const originalY = platform.getData('originalY');

            platform.setPosition(originalX, originalY);
            platform.setRotation(0);
            platform.setAlpha(0);
            platform.setVelocity(0, 0);
            (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
            (platform.body as Phaser.Physics.Arcade.Body).enable = true;
            platform.setData('playerStandingTime', 0);
            platform.setData('isCrumbling', false);
            platform.setData('hasFallen', false);
            platform.setData('hasBeenTouched', false);
            platform.setTint(0xFFAA66);

            // Fade in
            sceneRef.tweens.add({
                targets: platform,
                alpha: 1,
                duration: 500,
            });
        }

        function update(this: Phaser.Scene) {
            const delta = this.game.loop.delta;

            // Update crumbling platforms
            crumblingPlatforms.forEach(platform => {
                if (platform.getData('hasFallen')) return;

                const isCrumbling = platform.getData('isCrumbling');
                const hasBeenTouched = platform.getData('hasBeenTouched');

                if (!isCrumbling) {
                    // Check if player is touching this platform
                    if (isPlayerOnPlatform(platform) && !hasBeenTouched) {
                        // First contact - start 2 second timer
                        platform.setData('hasBeenTouched', true);
                        platform.setTint(0xFF8844); // Orange warning

                        // Schedule crumble in 2 seconds
                        this.time.delayedCall(2000, () => {
                            if (platform.getData('hasFallen')) return;

                            platform.setData('isCrumbling', true);
                            platform.setTint(0xFF4444); // Red
                            (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                            (platform.body as Phaser.Physics.Arcade.Body).setImmovable(false);

                            // Add rotation and fade out
                            this.tweens.add({
                                targets: platform,
                                alpha: 0,
                                rotation: Math.random() > 0.5 ? 1 : -1,
                                duration: 800,
                                onComplete: () => {
                                    platform.setData('hasFallen', true);
                                    (platform.body as Phaser.Physics.Arcade.Body).enable = false;

                                    // Schedule respawn
                                    const respawnTime = platform.getData('respawnTime');
                                    this.time.delayedCall(respawnTime, () => {
                                        respawnPlatform(platform);
                                    });
                                }
                            });
                        });
                    }
                }
            });

            if (cursors && player.body) {
                // Move Left (Arrow OR A)
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(-160);
                    player.anims.play('left', true);
                }
                // Move Right (Arrow OR D)
                else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(160);
                    player.anims.play('right', true);
                }
                // Stop Moving
                else {
                    player.setVelocityX(0);
                }

                // Jump if on a platform or world-floor (Arrow Up OR W)
                if ((cursors.up.isDown || keyW?.isDown) && player.body.blocked.down) {
                    player.setVelocityY(-330);
                }
            }
        }

        // Cleanup when React unmounts
        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div>
            <div className="background">
                <h1 className="text-container">AstroMario Game - Level 8</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 8: Crumbling Platforms</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game9')}>
                            <p className="p2">9th level</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame8;
