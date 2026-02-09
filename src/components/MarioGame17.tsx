import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';
import { useLevelCompletion } from '../context/LevelCompletionContext';
import LevelFooter from './LevelFooter';

const MarioGame17: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const { markLevelComplete } = useLevelCompletion();
    const onWinRef = useRef(() => markLevelComplete(17));
    onWinRef.current = () => markLevelComplete(17);

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
            // Bottom floor - spans entire width
            platforms.create(600, 585, 'ground').setScale(8, 0.5).refreshBody();
            // Flag platform
            platforms.create(1150, 225, 'ground').setScale(0.3).refreshBody();

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
            const flag = this.physics.add.sprite(1150, 205, 'flag').setScale(0.2);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Store game start time
            gameStartTime = this.time.now;

            // Create THREE large unkillable Warios with different behaviors

            // 1. CHASER - Red tint, actively chases Mario (starts top right)
            const chaserWario = this.physics.add.sprite(1150, 20, 'wario').setScale(0.35);
            chaserWario.setBounce(0.2);
            chaserWario.setCollideWorldBounds(true);
            chaserWario.setTint(0xFF6666); // Red tint
            chaserWario.setData('type', 'chaser');
            chaserWario.setData('jumpCooldown', 0);
            goombas.push(chaserWario);

            // 2. SHADOW - Dark purple, follows Mario's past path (starts where Mario starts, after 3 seconds)
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

            // 3. LUNGER - Orange tint, stays at the top and lunges when Mario approaches (starts top right)
            const lungerWario = this.physics.add.sprite(1180, 20, 'wario').setScale(0.35);
            lungerWario.setBounce(0.2);
            lungerWario.setCollideWorldBounds(true);
            lungerWario.setTint(0xFF9933); // Orange tint
            lungerWario.setData('type', 'lunger');
            lungerWario.setData('jumpCooldown', 0);
            lungerWario.setData('lungerState', 'falling'); // Start falling to find the flag platform
            lungerWario.setData('homeX', 1150);
            lungerWario.setData('homeY', 175);
            (lungerWario.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
            lungerWario.setData('groundedTime', 0);
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
                    onWinRef.current();
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0x00ff00);
                    this.add.text(600, 300, 'You Beat The Game! Congratulations!', {
                        fontSize: '48px',
                        color: '#ffffff',
                        fontFamily: 'Arial',
                    }).setOrigin(0.5, 0.5);
                }
            });

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
                        // LUNGER: Stays at flag platform, lunges when Mario gets close, then climbs back up
                        const dx = player.x - goomba.x;
                        const dy = player.y - goomba.y;
                        const distToPlayer = Math.sqrt(dx * dx + dy * dy);
                        const lungerState = goomba.getData('lungerState');
                        const homeX = goomba.getData('homeX');
                        const homeY = goomba.getData('homeY');

                        if (lungerState === 'falling') {
                            // Initial fall from top right - wait until landing near flag platform
                            if (goombaBody.blocked.down && Math.abs(goomba.x - homeX) < 100) {
                                goomba.setData('lungerState', 'waiting');
                                (goomba.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                                goomba.setPosition(homeX, homeY);
                            }

                        } else if (lungerState === 'waiting') {
                            // Stay on flag platform, wait for Mario
                            goomba.setVelocityX(0);

                            // Keep on platform
                            if (goomba.y > homeY + 20) {
                                goomba.setPosition(homeX, homeY);
                                (goomba.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                            }

                            // LUNGE if Mario gets within range
                            if (distToPlayer < 250) {
                                goomba.setData('lungerState', 'lunging');
                                (goomba.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                                // Dramatic lunge towards Mario!
                                const lungeSpeed = 300;
                                const angle = Math.atan2(dy, dx);
                                goomba.setVelocityX(Math.cos(angle) * lungeSpeed);
                                goomba.setVelocityY(Math.sin(angle) * lungeSpeed);
                            }

                        } else if (lungerState === 'lunging') {
                            // Falling/lunging - check if hit ground
                            if (goombaBody.blocked.down && goomba.y > 500) {
                                goomba.setData('lungerState', 'grounded');
                                goomba.setData('groundedTime', currentTime);
                                goomba.setVelocityX(0);
                            }

                        } else if (lungerState === 'grounded') {
                            // On ground, wait 5 seconds then climb back up
                            const groundedTime = goomba.getData('groundedTime');
                            goomba.setVelocityX(0);

                            if (currentTime - groundedTime >= 5000) {
                                goomba.setData('lungerState', 'climbing');
                            }

                        } else if (lungerState === 'climbing') {
                            // Climb back up to the flag platform
                            (goomba.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

                            const dxHome = homeX - goomba.x;
                            const dyHome = homeY - goomba.y;

                            // Move towards home position
                            const climbSpeed = 100;
                            if (Math.abs(dxHome) > 5) {
                                goomba.setVelocityX(dxHome > 0 ? climbSpeed : -climbSpeed);
                            } else {
                                goomba.setVelocityX(0);
                            }

                            if (Math.abs(dyHome) > 5) {
                                goomba.setVelocityY(dyHome > 0 ? climbSpeed : -climbSpeed);
                            } else {
                                goomba.setVelocityY(0);
                            }

                            // Reached home - back to waiting
                            if (Math.abs(dxHome) <= 5 && Math.abs(dyHome) <= 5) {
                                goomba.setPosition(homeX, homeY);
                                goomba.setVelocity(0, 0);
                                goomba.setData('lungerState', 'waiting');
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
                <h1 className="text-container">AstroMario Game - Level 17</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 17: The Chase (Final Level)</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game')}>
                            <p className="p2">1st level</p>
                        </button>
                        <div style={{ textAlign: "right", marginTop: "10px", color: "#aaa", fontSize: "14px" }}>Press R to restart level</div>
                    </div>
                </div>
            </div>
            <LevelFooter />
        </div>
    );
};

export default MarioGame17;
