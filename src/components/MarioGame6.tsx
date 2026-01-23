import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame6: React.FC = () => {
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
            platforms.create(400, 568, 'ground').setScale(2).refreshBody();
            platforms.create(400, 234, 'ground').setScale(0.4).refreshBody();
            const flagPlatform = platforms.create(790, 60, 'ground').setScale(0.05).refreshBody();
            platforms.create(10, 70, 'ground').setScale(0.30).refreshBody();

            // Create 15 moving platforms (all horizontal left-to-right)
            const platformConfigs = [
                { x: 400, y: 450, minX: 50, maxX: 700, speed: 117, direction: 1 },
                { x: 400, y: 280, minX: 50, maxX: 700, speed: 45, direction: -1 },
                { x: 400, y: 250, minX: 50, maxX: 700, speed: 202.5, direction: 1 },
                { x: 400, y: 350, minX: 50, maxX: 700, speed: 187.5, direction: -1 },
                { x: 400, y: 150, minX: 50, maxX: 700, speed: 18, direction: 1 },
                { x: 400, y: 480, minX: 50, maxX: 700, speed: 72, direction: -1 },
                { x: 400, y: 120, minX: 50, maxX: 700, speed: 192, direction: 1 },
                { x: 400, y: 380, minX: 50, maxX: 700, speed: 111, direction: -1 },
                { x: 400, y: 50, minX: 50, maxX: 700, speed: 50, direction: 1 },
            ];

            platformConfigs.forEach((config, index) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.05);
                platform.body.setAllowGravity(false);
                platform.body.setImmovable(true);
                platform.setData('minX', config.minX);
                platform.setData('maxX', config.maxX);
                platform.setData('speed', config.speed);
                platform.setData('direction', config.direction);
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
            player = this.physics.add.sprite(400, 500, 'mario');
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
                    player.setData('hasLost', true);
                    player.setVelocity(0, 0);
                    player.anims.stop();
                    player.setTint(0xb22222);
                    flagPlatform.destroy();
                    platforms.create(790, 50, 'ground').setScale(0.5).refreshBody();
                    checkpoint = this.add
                        .text(400, 50, 'You lost!', {
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
                // Stop Moving
                else {
                    player.setVelocityX(0);
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
                    <div style={{ textAlign: 'right', marginTop: '50px' }}>Level 6</div>
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
                    Hint:
                    <br />
                    50
                    <br />
                    192
                    <br />
                    18
                    <br />
                    202.5
                    <br />
                    -45
                    <br />
                    -187.5
                    <br />
                    -111
                    <br />
                    117
                    <br />
                    -72
                    <br />
                </div>
            </div>
        </div>
    );
};

export default MarioGame6;
