import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame5: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 800,
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
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let checkpoint: Phaser.GameObjects.Text | undefined;

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
            } else {
                console.warn('Keyboard input not available.');
            }

            // Add background
            this.add.image(400, 300, 'sky');

            // Create static platforms
            platforms = this.physics.add.staticGroup();
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();
            const flagPlatform = platforms.create(790, 45, 'ground').setScale(0.05).refreshBody();
            platforms.create(10, 70, 'ground').setScale(0.30).refreshBody();

            // Create 15 moving platforms (all horizontal left-to-right)
            const platformConfigs = [
                { x: 120, y: 450, minX: 50, maxX: 200, speed: 30 },
                { x: 500, y: 280, minX: 450, maxX: 600, speed: 135 },
                { x: 680, y: 480, minX: 600, maxX: 750, speed: 140 },
                { x: 150, y: 250, minX: 100, maxX: 250, speed: 125 },
                { x: 580, y: 350, minX: 520, maxX: 650, speed: 12 },
                { x: 250, y: 150, minX: 150, maxX: 300, speed: 48 },
                { x: 380, y: 480, minX: 330, maxX: 480, speed: 36 },
                { x: 520, y: 120, minX: 470, maxX: 620, speed: 74 },
                { x: 280, y: 380, minX: 230, maxX: 380, speed: 78 },
                { x: 600, y: 150, minX: 550, maxX: 700, speed: 91 },
            ];

            platformConfigs.forEach((config, index) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.5);
                platform.setAngularVelocity(60);
                platform.body.setAllowGravity(false);
                platform.body.setImmovable(true);
                platform.setData('minX', config.minX);
                platform.setData('maxX', config.maxX);
                platform.setData('speed', config.speed);
                platform.setData('direction', Math.random() > 0.5 ? 1 : -1); // Random starting direction
                movingPlatforms.push(platform);
            });

            //Create flag
            const flag = this.physics.add.sprite(790, 41, 'flag').setScale(0.05);
            flag.setOrigin(0.5, 1);
            flag.body.setAllowGravity(false);

            const fakeFlag = this.physics.add.sprite(10, 63, 'flag').setScale(0.5);
            fakeFlag.setOrigin(0.5, 1);
            fakeFlag.body.setAllowGravity(false);

            // Create player
            player = this.physics.add.sprite(50, 450, 'mario');
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

            // Collider: player vs. moving platforms
            movingPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Callback: when Mario lands on any platform
            this.physics.add.collider(
                player,
                platforms,
                (_playerObj: any, _platformObj: any) => {
                    if (!player.getData('hasLost') && !player.getData('hasWon')) {
                        if (player.body?.blocked.down) {
                            console.log('Mario landed on a platform at y=', player.y);
                        }
                    }
                },
                undefined,
                this
            );

            // Overlap: player vs. flag
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0x00ff00);
                    this.add
                        .text(400, 300, 'You won', {
                            fontSize: '48px',
                            color: '#ffffff',
                            fontFamily: 'Arial',
                        })
                        .setOrigin(0.5, 0.5);
                }
            });

            // Overlap: player vs. fake flag
            this.physics.add.overlap(player, fakeFlag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    flag.setScale(0.3);
                    flagPlatform.destroy();
                    platforms.create(790, 50, 'ground').setScale(0.5).refreshBody();
                    checkpoint = this.add
                        .text(400, 50, 'Now capture the real flag!', {
                            fontSize: '24px',
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
                        console.log('Mario hit the bottom world-bound (ground).');

                        if (!player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0xb22222);
                            checkpoint?.destroy();
                            checkpoint = undefined;
                            this.add
                                .text(400, 300, 'Game Over', {
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
            // Update moving platforms (all horizontal movement)
            movingPlatforms.forEach(platform => {
                const speed = platform.getData('speed');
                const direction = platform.getData('direction');
                const minX = platform.getData('minX');
                const maxX = platform.getData('maxX');

                platform.setVelocityX(speed * direction);

                // Reverse direction when hitting boundaries
                if (platform.x <= minX && direction === -1) {
                    platform.setData('direction', 1);
                } else if (platform.x >= maxX && direction === 1) {
                    platform.setData('direction', -1);
                }
            });

            // Slide Mario to the right while on a moving platform (include platform velocity)
            let onMovingPlatform = false;
            let platformVX = 0;
            if (player.body) {
                const body = player.body as Phaser.Physics.Arcade.Body;
                for (const platform of movingPlatforms) {
                    const platBody = platform.body as Phaser.Physics.Arcade.Body;
                    if (!platBody) continue;
                    const touchingDown = body.blocked.down || body.touching.down;
                    const closeY = Math.abs(body.bottom - platBody.top) <= 3;
                    const overlapX = body.right > platBody.left && body.left < platBody.right;
                    if (touchingDown && closeY && overlapX) {
                        onMovingPlatform = true;
                        platformVX = platBody.velocity.x;
                        break;
                    }
                }
                if (onMovingPlatform) {
                    player.setAngularVelocity(30);
                    const slideRightSpeed = 50; // adjust to taste
                    player.setVelocityX(platformVX + slideRightSpeed);
                } else {
                    player.setAngularVelocity(0);
                    player.setAngle(0);
                }
            }

            if (cursors && player.body) {
                // Move Left
                if (cursors.left.isDown) {
                    player.setVelocityX(-160);
                    player.anims.play('left', true);
                }
                // Move Right
                else if (cursors.right.isDown) {
                    player.setVelocityX(160);
                    player.anims.play('right', true);
                }
                // Stop Moving (but keep sliding when on a moving platform)
                else {
                    if (!onMovingPlatform) {
                        player.setVelocityX(0);
                    }
                }

                // Jump if on a platform or world-floor
                if (cursors.up.isDown && player.body.blocked.down) {
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
                <h1 className="text-container">AstroMario Game</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <button className="button" onClick={() => navigate('AI')}>
                        <p className="p2">View AI</p>
                    </button>
                    <div style={{ textAlign: 'right', marginTop: '50px' }}>Level 4</div>
                    <button className="button" onClick={() => navigate('game')}>
                        <p className="p2">1st level</p>
                    </button>
                    <div style={{ textAlign: 'right', marginTop: '50px' }}>
                        <a
                            href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-block',
                                fontSize: '18px',
                                backgroundColor: '#ff4757',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                            }}
                        >
                            Click for a surprise! 🎁
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame5;
