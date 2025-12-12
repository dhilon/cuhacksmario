import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame3: React.FC = () => {
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
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

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

            // Create platforms
            platforms = this.physics.add.staticGroup();
            platforms.create(335, 568, 'ground').setScale(2).refreshBody();
            platforms.create(100, 500, 'ground').setScale(0.05).refreshBody();
            platforms.create(200, 367, 'ground').setScale(0.05).refreshBody();
            platforms.create(200, 325, 'ground').setScale(0.05).refreshBody();
            platforms.create(25, 200, 'ground').setScale(0.05).refreshBody();
            platforms.create(200, 75, 'ground').setScale(0.05).refreshBody();
            platforms.create(230, 105, 'ground').setScale(0.05).refreshBody();
            platforms.create(370, 105, 'ground').setScale(0.05).refreshBody();
            platforms.create(440, 105, 'ground').setScale(0.05).refreshBody();


            platforms.create(750, 400, 'ground').setScale(0.05).refreshBody();

            platforms.create(750, 300, 'ground').setScale(0.05).refreshBody();

            platforms.create(750, 500, 'ground').setScale(0.05).refreshBody();

            platforms.create(785, 200, 'ground').setScale(0.05).refreshBody();





            platforms.create(790, 70, 'ground').setScale(0.30).refreshBody();

            //Create flag
            const flag = this.physics.add.sprite(790, 63, 'flag').setScale(0.5);
            flag.setOrigin(0.5, 1);
            flag.body.setAllowGravity(false);

            // Create player
            player = this.physics.add.sprite(350, 450, 'mario');
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

            // Collider: player vs. platforms (so Mario can walk/stand on them)
            this.physics.add.collider(player, platforms);

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
                    <div style={{ textAlign: 'right', marginTop: '50px' }}>Level 3</div>
                    <button className="button" onClick={() => navigate('game4')}>
                        <p className="p2">4th level</p>
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

export default MarioGame3;
