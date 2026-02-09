import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame9: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(9));
    onWinRef.current = () => markLevelComplete(9);

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
        let icePlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let checkpoint: Phaser.GameObjects.Text | undefined;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Ice physics constants
        const ICE_ACCELERATION = 8;
        const ICE_MAX_SPEED = 200;
        const ICE_FRICTION = 0.98;
        const ICE_DIRECTION_CHANGE = 6;

        let currentVelocityX = 0;
        let lastDirection = 1; // -1 for left, 1 for right (default facing right)
        let wasOnIce = false; // Track if player was on ice last frame
        const ICE_LANDING_PUSH = 50; // Initial slide speed when landing on ice

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
            // Flag platform in top right
            platforms.create(1170, 60, 'ground').setScale(0.05).refreshBody();

            // Starting platform in bottom left - icy!
            const startPlatform = this.physics.add.sprite(50, 568, 'ground').setScale(2);
            (startPlatform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            (startPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
            startPlatform.setTint(0x88CCFF); // Light blue tint to indicate ice
            startPlatform.setData('minX', 50);
            startPlatform.setData('maxX', 50);
            startPlatform.setData('speed', 0);
            startPlatform.setData('direction', 0);
            startPlatform.setData('changeTimer', 99999);
            icePlatforms.push(startPlatform);

            // Create long thin ice strip platforms that move left/right
            const platformConfigs = [
                { x: 300, y: 500, minX: 100, maxX: 500, speed: 60 },
                { x: 700, y: 480, minX: 500, maxX: 900, speed: 80 },
                { x: 1000, y: 460, minX: 800, maxX: 1150, speed: 50 },
                { x: 200, y: 400, minX: 50, maxX: 400, speed: 70 },
                { x: 600, y: 380, minX: 400, maxX: 800, speed: 90 },
                { x: 950, y: 360, minX: 750, maxX: 1150, speed: 55 },
                { x: 150, y: 300, minX: 50, maxX: 350, speed: 85 },
                { x: 550, y: 280, minX: 350, maxX: 750, speed: 65 },
                { x: 900, y: 260, minX: 700, maxX: 1100, speed: 75 },
                { x: 250, y: 200, minX: 100, maxX: 450, speed: 95 },
                { x: 650, y: 180, minX: 450, maxX: 850, speed: 60 },
                { x: 1000, y: 160, minX: 800, maxX: 1150, speed: 70 },
                { x: 400, y: 100, minX: 200, maxX: 600, speed: 80 },
                { x: 850, y: 80, minX: 650, maxX: 1050, speed: 50 },
            ];

            platformConfigs.forEach((config) => {
                // Create long thin strip platform (wide but short)
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(0.8, 0.06); // Extra wide and thin
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setTint(0x88CCFF); // Light blue tint to indicate ice

                // Store movement data
                platform.setData('minX', config.minX);
                platform.setData('maxX', config.maxX);
                platform.setData('speed', config.speed);
                platform.setData('direction', Math.random() > 0.5 ? 1 : -1); // Random initial direction
                platform.setData('changeTimer', Math.random() * 2000); // Random time to potentially change direction

                icePlatforms.push(platform);
            });

            //Create flag
            const flag = this.physics.add.sprite(1170, 41, 'flag').setScale(0.15);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player - start in bottom left
            player = this.physics.add.sprite(50, 500, 'mario');
            player.setBounce(0.2);
            player.setCollideWorldBounds(true);
            // @ts-ignore: onWorldBounds is read-only in TS definitions
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

            // Collider: player vs. static platforms
            this.physics.add.collider(player, platforms);

            // Collider: player vs. ice platforms
            icePlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Helper function to check if player is on an ice platform
            function isOnIcePlatform(): boolean {
                if (!player.body || !player.body.blocked.down) return false;

                const playerBounds = player.getBounds();

                for (const platform of icePlatforms) {
                    if (!(platform.body as Phaser.Physics.Arcade.Body).enable) continue;
                    const platformBounds = platform.getBounds();

                    const horizontalOverlap = playerBounds.right > platformBounds.left &&
                                              playerBounds.left < platformBounds.right;
                    const verticalTouch = Math.abs(playerBounds.bottom - platformBounds.top) < 15;

                    if (horizontalOverlap && verticalTouch) return true;
                }
                return false;
            }

            // Store the function for use in update
            (this as any).isOnIcePlatform = isOnIcePlatform;

            // Overlap: player vs. flag
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
                    onWinRef.current();
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

        function update(this: Phaser.Scene) {
            const delta = this.game.loop.delta;

            // Update moving ice platforms
            icePlatforms.forEach(platform => {
                const speed = platform.getData('speed');
                let direction = platform.getData('direction');
                const minX = platform.getData('minX');
                const maxX = platform.getData('maxX');
                let changeTimer = platform.getData('changeTimer');

                // Move platform
                platform.setVelocityX(speed * direction);

                // Reverse direction when hitting boundaries
                if (platform.x <= minX && direction === -1) {
                    platform.setData('direction', 1);
                } else if (platform.x >= maxX && direction === 1) {
                    platform.setData('direction', -1);
                }

                // Randomly change direction occasionally
                changeTimer -= delta;
                if (changeTimer <= 0) {
                    if (Math.random() < 0.3) { // 30% chance to change direction
                        platform.setData('direction', -direction);
                    }
                    platform.setData('changeTimer', 1500 + Math.random() * 2000); // Reset timer
                } else {
                    platform.setData('changeTimer', changeTimer);
                }
            });

            if (cursors && player.body) {
                const isMovingLeft = cursors.left.isDown || keyA?.isDown;
                const isMovingRight = cursors.right.isDown || keyD?.isDown;
                const onIce = (this as any).isOnIcePlatform();

                // Detect landing on ice with no momentum - give initial slide
                if (onIce && !wasOnIce && Math.abs(currentVelocityX) < 10) {
                    currentVelocityX = lastDirection * ICE_LANDING_PUSH;
                }
                wasOnIce = onIce;

                if (onIce) {
                    // Ice physics movement - slippery!
                    if (isMovingLeft) {
                        if (lastDirection === 1) {
                            currentVelocityX += ICE_DIRECTION_CHANGE;
                        }
                        currentVelocityX -= ICE_ACCELERATION;
                        lastDirection = -1;
                        player.anims.play('left', true);
                    } else if (isMovingRight) {
                        if (lastDirection === -1) {
                            currentVelocityX -= ICE_DIRECTION_CHANGE;
                        }
                        currentVelocityX += ICE_ACCELERATION;
                        lastDirection = 1;
                        player.anims.play('right', true);
                    } else {
                        // Apply friction when no keys pressed
                        currentVelocityX *= ICE_FRICTION;
                        if (Math.abs(currentVelocityX) < 5) {
                            currentVelocityX = 0;
                        }
                    }

                    // Cap at max speed
                    if (currentVelocityX > ICE_MAX_SPEED) {
                        currentVelocityX = ICE_MAX_SPEED;
                    } else if (currentVelocityX < -ICE_MAX_SPEED) {
                        currentVelocityX = -ICE_MAX_SPEED;
                    }

                    player.setVelocityX(currentVelocityX);
                } else {
                    // Normal movement when not on ice
                    if (isMovingLeft) {
                        player.setVelocityX(-160);
                        player.anims.play('left', true);
                        currentVelocityX = -160;
                        lastDirection = -1;
                    } else if (isMovingRight) {
                        player.setVelocityX(160);
                        player.anims.play('right', true);
                        currentVelocityX = 160;
                        lastDirection = 1;
                    } else {
                        player.setVelocityX(0);
                        currentVelocityX = 0;
                    }
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
                <h1 className="text-container">AstroMario Game - Level 9</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 9: Ice Platforms</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game10')}>
                            <p className="p2">10th level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame9;
