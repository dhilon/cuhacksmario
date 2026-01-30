import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame7: React.FC = () => {
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
        let disappearingPlatforms: Phaser.Physics.Arcade.Sprite[] = [];
        let goombas: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let checkpoint: Phaser.GameObjects.Text | undefined;

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
            // Starting platform in bottom left corner
            platforms.create(50, 568, 'ground').setScale(2).refreshBody();
            // Flag platform on right edge
            const flagPlatform = platforms.create(1185, 60, 'ground').setScale(0.05).refreshBody();

            // Create disappearing platforms - zigzag pattern with longer jumps
            const platformConfigs = [
                { x: 80, y: 480, visibleDuration: 3000, invisibleDuration: 1500, phaseOffset: 0 },
                { x: 280, y: 420, visibleDuration: 2500, invisibleDuration: 2000, phaseOffset: 500 },
                { x: 500, y: 480, visibleDuration: 2000, invisibleDuration: 1500, phaseOffset: 1000 },
                { x: 720, y: 400, visibleDuration: 3500, invisibleDuration: 1000, phaseOffset: 1500 },
                { x: 950, y: 460, visibleDuration: 2500, invisibleDuration: 2000, phaseOffset: 2000 },
                { x: 1120, y: 380, visibleDuration: 3000, invisibleDuration: 1500, phaseOffset: 500 },
                { x: 900, y: 320, visibleDuration: 2000, invisibleDuration: 1500, phaseOffset: 800 },
                { x: 650, y: 280, visibleDuration: 3000, invisibleDuration: 2000, phaseOffset: 1200 },
                { x: 400, y: 340, visibleDuration: 2500, invisibleDuration: 1500, phaseOffset: 300 },
                { x: 150, y: 280, visibleDuration: 3500, invisibleDuration: 1000, phaseOffset: 1800 },
                { x: 350, y: 200, visibleDuration: 2000, invisibleDuration: 2000, phaseOffset: 600 },
                { x: 600, y: 150, visibleDuration: 3000, invisibleDuration: 1500, phaseOffset: 1400 },
                { x: 850, y: 180, visibleDuration: 2500, invisibleDuration: 1500, phaseOffset: 900 },
                { x: 1050, y: 120, visibleDuration: 3000, invisibleDuration: 2000, phaseOffset: 400 },
                { x: 1150, y: 80, visibleDuration: 2500, invisibleDuration: 1500, phaseOffset: 1600 },
            ];

            const currentTime = this.time.now;

            platformConfigs.forEach((config, index) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground').setScale(0.15);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('visibleDuration', config.visibleDuration);
                platform.setData('invisibleDuration', config.invisibleDuration);
                platform.setData('phaseOffset', config.phaseOffset);
                platform.setData('isVisible', true);
                platform.setData('lastToggleTime', currentTime + config.phaseOffset);
                platform.setTint(0x88FF88); // Light green tint to indicate disappearing
                disappearingPlatforms.push(platform);

                // 20% chance to assign a goomba to this platform (appears 1 out of every 3 cycles)
                if (Math.random() < 0.2) {
                    const goomba = this.physics.add.sprite(config.x, config.y - 30, 'goomba').setScale(0.8);
                    (goomba.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                    (goomba.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                    goomba.setData('platformIndex', index);
                    goomba.setData('cycleCounter', index % 3); // Stagger starting cycle between blocks
                    goombas.push(goomba);
                }
            });

            //Create flag on right edge
            const flag = this.physics.add.sprite(1185, 41, 'flag').setScale(0.15);
            flag.setOrigin(0.5, 1);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player in bottom left corner
            player = this.physics.add.sprite(60, 500, 'mario');
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

            // Collider: player vs. disappearing platforms
            disappearingPlatforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Overlap: player vs. goombas
            goombas.forEach(goomba => {
                this.physics.add.overlap(player, goomba, () => {
                    if (!player.getData('hasLost') && !player.getData('hasWon') && !goomba.getData('isDead')) {
                        const playerBottom = player.getBounds().bottom;
                        const goombaTop = goomba.getBounds().top;
                        const playerVelY = player.body?.velocity.y || 0;

                        // Check if Mario is landing on top of goomba
                        if (playerVelY > 0 && playerBottom < goombaTop + 20) {
                            // Kill the goomba
                            goomba.setData('isDead', true);
                            goomba.setTint(0x666666);
                            goomba.setAlpha(0.5);
                            (goomba.body as Phaser.Physics.Arcade.Body).enable = false;
                            // Give Mario a bounce
                            player.setVelocityY(-200);
                        } else {
                            // Mario dies
                            player.setData('hasLost', true);
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0xb22222);
                            this.add
                                .text(600, 300, 'Game Over', {
                                    fontSize: '48px',
                                    color: '#ffffff',
                                    fontFamily: 'Arial',
                                })
                                .setOrigin(0.5, 0.5);
                        }
                    }
                });
            });

            // Overlap: player vs. flag
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
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
            const currentTime = this.time.now;

            // Update disappearing platforms
            disappearingPlatforms.forEach((platform, index) => {
                const isVisible = platform.getData('isVisible');
                const lastToggleTime = platform.getData('lastToggleTime');
                const visibleDuration = platform.getData('visibleDuration');
                const invisibleDuration = platform.getData('invisibleDuration');

                // Find goomba on this platform (if any)
                const goomba = goombas.find(g => g.getData('platformIndex') === index);

                const duration = isVisible ? visibleDuration : invisibleDuration;
                const elapsed = currentTime - lastToggleTime;

                // Warning blink before disappearing (500ms before)
                if (isVisible && elapsed > duration - 500) {
                    const blinkRate = Math.floor((currentTime / 100) % 2);
                    platform.setAlpha(blinkRate === 0 ? 0.5 : 1);
                    // Only blink goomba if it's currently visible
                    if (goomba && goomba.alpha > 0) {
                        goomba.setAlpha(blinkRate === 0 ? 0.5 : 1);
                    }
                }

                if (elapsed >= duration) {
                    platform.setData('lastToggleTime', currentTime);
                    platform.setData('isVisible', !isVisible);

                    if (isVisible) {
                        // Fade out platform and goomba
                        this.tweens.add({
                            targets: platform,
                            alpha: 0,
                            duration: 200,
                            onComplete: () => {
                                (platform.body as Phaser.Physics.Arcade.Body).enable = false;
                            }
                        });
                        if (goomba) {
                            this.tweens.add({
                                targets: goomba,
                                alpha: 0,
                                duration: 200,
                                onComplete: () => {
                                    (goomba.body as Phaser.Physics.Arcade.Body).enable = false;
                                }
                            });
                        }
                    } else {
                        // Fade in platform
                        (platform.body as Phaser.Physics.Arcade.Body).enable = true;
                        this.tweens.add({
                            targets: platform,
                            alpha: 1,
                            duration: 200,
                        });
                        // Goomba appears 1 out of every 3 cycles
                        if (goomba) {
                            const cycleCounter = goomba.getData('cycleCounter');
                            goomba.setData('cycleCounter', (cycleCounter + 1) % 3); // Increment cycle
                            if (cycleCounter === 0) {
                                // Show goomba this cycle
                                (goomba.body as Phaser.Physics.Arcade.Body).enable = true;
                                this.tweens.add({
                                    targets: goomba,
                                    alpha: 1,
                                    duration: 200,
                                });
                            } else {
                                // Keep goomba hidden this cycle
                                goomba.setAlpha(0);
                                (goomba.body as Phaser.Physics.Arcade.Body).enable = false;
                            }
                        }
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
                <h1 className="text-container">AstroMario Game - Level 7</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 7: Disappearing Platforms</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game8')}>
                            <p className="p2">8th level</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame7;
