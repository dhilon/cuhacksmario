import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame12: React.FC = () => {
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
        let movingPlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let disappearingPlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let goombas: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Shadow wario - follows player's past positions
        let playerPositionHistory: { x: number; y: number }[] = [];
        const SHADOW_DELAY = 120; // Number of frames to delay (about 2 seconds at 60fps)
        let gameStartTime = 0;
        const SHADOW_APPEAR_DELAY = 3000; // 3 seconds before shadow appears

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
            this.load.image('wario', '/wario.png');
        }

        function create(this: Phaser.Scene) {
            // Focus the game canvas
            this.game.canvas.setAttribute('tabindex', '0');
            this.game.canvas.focus();

            // Enable keyboard input
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
                cursors = this.input.keyboard.createCursorKeys();
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
            // Starting platform
            platforms.create(100, 568, 'ground').setScale(2).refreshBody();
            // Flag platform
            platforms.create(1150, 100, 'ground').setScale(0.3).refreshBody();

            // Create moving platforms
            const movingConfigs = [
                { x: 300, y: 480, minX: 150, maxX: 450, speed: 80 },
                { x: 600, y: 400, minX: 450, maxX: 750, speed: 100 },
                { x: 900, y: 320, minX: 750, maxX: 1050, speed: 70 },
                { x: 400, y: 240, minX: 250, maxX: 550, speed: 90 },
                { x: 700, y: 160, minX: 550, maxX: 850, speed: 110 },
                { x: 1000, y: 200, minX: 900, maxX: 1100, speed: 60 },
            ];

            movingConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.3);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('minX', config.minX);
                platform.setData('maxX', config.maxX);
                platform.setData('speed', config.speed);
                platform.setData('direction', Math.random() > 0.5 ? 1 : -1);
                movingPlatforms.push(platform);
            });

            // Create disappearing platforms
            const disappearingConfigs = [
                { x: 200, y: 380, visibleDuration: 3000, invisibleDuration: 2000, phaseOffset: 0 },
                { x: 500, y: 300, visibleDuration: 2500, invisibleDuration: 1500, phaseOffset: 1000 },
                { x: 800, y: 220, visibleDuration: 3000, invisibleDuration: 2000, phaseOffset: 500 },
                { x: 350, y: 140, visibleDuration: 2000, invisibleDuration: 1500, phaseOffset: 1500 },
            ];

            const currentTime = this.time.now;

            disappearingConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.25);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('visibleDuration', config.visibleDuration);
                platform.setData('invisibleDuration', config.invisibleDuration);
                platform.setData('phaseOffset', config.phaseOffset);
                platform.setData('isVisible', true);
                platform.setData('lastToggleTime', currentTime + config.phaseOffset);
                platform.setTint(0x88FF88); // Light green tint
                disappearingPlatforms.push(platform);
            });

            // Create flag
            const flag = this.physics.add.sprite(1150, 80, 'flag').setScale(0.2);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Store game start time
            gameStartTime = this.time.now;

            // Create THREE large unkillable Warios with different behaviors

            // 1. CHASER - Red tint, actively chases Mario
            const chaserWario = this.physics.add.sprite(300, 500, 'wario').setScale(0.35);
            chaserWario.setBounce(0.2);
            chaserWario.setCollideWorldBounds(true);
            chaserWario.setTint(0xFF6666); // Red tint
            chaserWario.setData('type', 'chaser');
            chaserWario.setData('jumpCooldown', 0);
            goombas.push(chaserWario);

            // 2. SHADOW - Dark purple, follows Mario's past path (prevents backtracking)
            const shadowWario = this.physics.add.sprite(100, 500, 'wario').setScale(0.35);
            shadowWario.setBounce(0.2);
            shadowWario.setCollideWorldBounds(true);
            shadowWario.setTint(0x440066); // Dark purple
            shadowWario.setAlpha(0); // Initially invisible - appears after 3 seconds
            shadowWario.setData('type', 'shadow');
            shadowWario.setData('jumpCooldown', 0);
            shadowWario.setData('hasAppeared', false);
            (shadowWario.body as Phaser.Physics.Arcade.Body).enable = false; // Disable collision initially
            goombas.push(shadowWario);

            // 3. LUNGER - Orange tint, stays at the top and lunges when Mario approaches
            const lungerWario = this.physics.add.sprite(1000, 150, 'wario').setScale(0.35);
            lungerWario.setBounce(0.2);
            lungerWario.setCollideWorldBounds(true);
            lungerWario.setTint(0xFF9933); // Orange tint
            lungerWario.setData('type', 'lunger');
            lungerWario.setData('jumpCooldown', 0);
            lungerWario.setData('isLunging', false);
            lungerWario.setData('homeX', 1000);
            lungerWario.setData('homeY', 150);
            goombas.push(lungerWario);

            // Create player
            player = this.physics.add.sprite(100, 500, 'mario');
            player.setBounce(0.2);
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
            movingPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
                goombas.forEach(goomba => {
                    this.physics.add.collider(goomba, platform);
                });
            });
            disappearingPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
                goombas.forEach(goomba => {
                    this.physics.add.collider(goomba, platform);
                });
            });
            goombas.forEach(goomba => {
                this.physics.add.collider(goomba, platforms);
            });

            // Goomba overlap - unkillable, always kills Mario
            goombas.forEach(goomba => {
                this.physics.add.overlap(player, goomba, () => {
                    if (!player.getData('hasLost') && !player.getData('hasWon')) {
                        const playerBottom = player.getBounds().bottom;
                        const goombaTop = goomba.getBounds().top;
                        const playerVelY = player.body?.velocity.y || 0;

                        // Even landing on top just bounces - goomba is unkillable
                        if (playerVelY > 0 && playerBottom < goombaTop + 20) {
                            player.setVelocityY(-250); // Bounce off
                        } else {
                            // Mario dies
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
                });
            });

            // Flag overlap
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0x00ff00);
                    this.add.text(600, 300, 'You Won! Congratulations!', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            });

            // World bounds collision
            this.physics.world.on(
                'worldbounds',
                (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean) => {
                    if (body.gameObject === player && down) {
                        if (!player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0xb22222);
                            this.add.text(600, 300, 'Game Over', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);
                        }
                    }
                }
            );
        }

        function update(this: Phaser.Scene) {
            const currentTime = this.time.now;
            const delta = this.game.loop.delta;

            // Update moving platforms
            movingPlatforms.forEach(platform => {
                const speed = platform.getData('speed');
                const direction = platform.getData('direction');
                const minX = platform.getData('minX');
                const maxX = platform.getData('maxX');

                platform.setVelocityX(speed * direction);

                if (platform.x <= minX && direction === -1) {
                    platform.setData('direction', 1);
                } else if (platform.x >= maxX && direction === 1) {
                    platform.setData('direction', -1);
                }
            });

            // Update disappearing platforms
            disappearingPlatforms.forEach((platform) => {
                const isVisible = platform.getData('isVisible');
                const lastToggleTime = platform.getData('lastToggleTime');
                const visibleDuration = platform.getData('visibleDuration');
                const invisibleDuration = platform.getData('invisibleDuration');

                const duration = isVisible ? visibleDuration : invisibleDuration;
                const elapsed = currentTime - lastToggleTime;

                // Warning blink
                if (isVisible && elapsed > duration - 500) {
                    const blinkRate = Math.floor((currentTime / 100) % 2);
                    platform.setAlpha(blinkRate === 0 ? 0.5 : 1);
                }

                if (elapsed >= duration) {
                    platform.setData('lastToggleTime', currentTime);
                    platform.setData('isVisible', !isVisible);

                    if (isVisible) {
                        this.tweens.add({
                            targets: platform,
                            alpha: 0,
                            duration: 200,
                            onComplete: () => {
                                (platform.body as Phaser.Physics.Arcade.Body).enable = false;
                            }
                        });
                    } else {
                        (platform.body as Phaser.Physics.Arcade.Body).enable = true;
                        this.tweens.add({
                            targets: platform,
                            alpha: 1,
                            duration: 200,
                        });
                    }
                }
            });

            // Record player position for shadow goomba
            if (!player.getData('hasLost') && !player.getData('hasWon')) {
                playerPositionHistory.push({ x: player.x, y: player.y });
                // Keep history limited
                if (playerPositionHistory.length > SHADOW_DELAY + 10) {
                    playerPositionHistory.shift();
                }
            }

            // Update Warios based on their type
            goombas.forEach(goomba => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    const goombaBody = goomba.body as Phaser.Physics.Arcade.Body;
                    const goombaType = goomba.getData('type');

                    // Check if shadow should appear (after 3 seconds)
                    if (goombaType === 'shadow' && !goomba.getData('hasAppeared')) {
                        if (currentTime - gameStartTime >= SHADOW_APPEAR_DELAY) {
                            goomba.setData('hasAppeared', true);
                            goomba.setAlpha(0.7);
                            (goomba.body as Phaser.Physics.Arcade.Body).enable = true;
                        } else {
                            return; // Skip shadow update until it appears
                        }
                    }

                    let jumpCooldown = goomba.getData('jumpCooldown') || 0;
                    jumpCooldown -= delta;
                    goomba.setData('jumpCooldown', jumpCooldown);

                    if (goombaType === 'chaser') {
                        // CHASER: Actively pursues Mario
                        const dx = player.x - goomba.x;
                        const dy = player.y - goomba.y;
                        const chaseSpeed = 110;

                        if (dx > 10) {
                            goomba.setVelocityX(chaseSpeed);
                        } else if (dx < -10) {
                            goomba.setVelocityX(-chaseSpeed);
                        } else {
                            goomba.setVelocityX(0);
                        }

                        // Jump towards Mario
                        if (dy < -50 && goombaBody.blocked.down && jumpCooldown <= 0) {
                            goomba.setVelocityY(-320);
                            goomba.setData('jumpCooldown', 800);
                        }

                    } else if (goombaType === 'shadow') {
                        // SHADOW: Follows Mario's past positions (prevents backtracking)
                        if (playerPositionHistory.length >= SHADOW_DELAY) {
                            const pastPos = playerPositionHistory[0];
                            const dx = pastPos.x - goomba.x;
                            const dy = pastPos.y - goomba.y;
                            const shadowSpeed = 130;

                            if (dx > 5) {
                                goomba.setVelocityX(shadowSpeed);
                            } else if (dx < -5) {
                                goomba.setVelocityX(-shadowSpeed);
                            } else {
                                goomba.setVelocityX(0);
                            }

                            // Jump if target is above
                            if (dy < -40 && goombaBody.blocked.down && jumpCooldown <= 0) {
                                goomba.setVelocityY(-350);
                                goomba.setData('jumpCooldown', 600);
                            }
                        }

                    } else if (goombaType === 'lunger') {
                        // LUNGER: Stays at top, lunges when Mario gets close
                        const dx = player.x - goomba.x;
                        const dy = player.y - goomba.y;
                        const distToPlayer = Math.sqrt(dx * dx + dy * dy);
                        const isLunging = goomba.getData('isLunging');
                        const homeX = goomba.getData('homeX');
                        const homeY = goomba.getData('homeY');

                        if (!isLunging) {
                            // Wait at home position, watching for Mario
                            const dxHome = homeX - goomba.x;

                            // Slowly return to home if not there
                            if (Math.abs(dxHome) > 10) {
                                goomba.setVelocityX(dxHome > 0 ? 30 : -30);
                            } else {
                                goomba.setVelocityX(0);
                            }

                            // LUNGE if Mario gets within range (top area of screen)
                            if (player.y < 250 && distToPlayer < 300) {
                                goomba.setData('isLunging', true);
                                // Dramatic lunge!
                                const lungeSpeed = 250;
                                const angle = Math.atan2(dy, dx);
                                goomba.setVelocityX(Math.cos(angle) * lungeSpeed);
                                goomba.setVelocityY(Math.sin(angle) * lungeSpeed - 100);
                            }
                        } else {
                            // Currently lunging - chase aggressively
                            const lungeChaseSpeed = 180;
                            if (dx > 10) {
                                goomba.setVelocityX(lungeChaseSpeed);
                            } else if (dx < -10) {
                                goomba.setVelocityX(-lungeChaseSpeed);
                            }

                            // Jump if needed
                            if (dy < -30 && goombaBody.blocked.down && jumpCooldown <= 0) {
                                goomba.setVelocityY(-380);
                                goomba.setData('jumpCooldown', 500);
                            }

                            // Return to waiting if Mario goes back down
                            if (player.y > 350) {
                                goomba.setData('isLunging', false);
                            }
                        }
                    }
                }
            });

            // Player movement
            if (cursors && player.body) {
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
                        <strong>Level 12: The Chase</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game')}>
                            <p className="p2">1st level</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame12;
