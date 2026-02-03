import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame11: React.FC = () => {
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
                    gravity: { x: 0, y: -300 }, // INVERTED GRAVITY - pulls UP
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
        let platforms: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let sceneRef: Phaser.Scene;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Gravity state
        let gravityInverted = true; // Start with inverted gravity (pulling UP)
        const GRAVITY_STRENGTH = 350;

        // Gravity revert mechanic
        let canUseGravityRevert = true;
        let cooldownRemaining = 0;
        let revertTimeRemaining = 0;
        let isGravityReverted = false;
        let cooldownText: Phaser.GameObjects.Text;
        let revertText: Phaser.GameObjects.Text;
        let keySpace: Phaser.Input.Keyboard.Key | undefined;

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
                keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
                keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
                keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            }

            sceneRef = this;

            // Add background
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1200, 600);

            // Function to generate random platforms
            function generateRandomPlatforms() {
                const configs = [];

                // Fixed starting platform at top-left (ceiling)
                configs.push({ x: 100, y: 40, scaleX: 1.2, scaleY: 0.15, isFixed: true });

                // Fixed flag platform at bottom-right
                configs.push({ x: 1150, y: 570, scaleX: 0.2, scaleY: 0.1, isFixed: true });

                // Generate 18 random platforms spread across the screen
                // Upper section (y: 60-200) - 6 platforms
                for (let i = 0; i < 6; i++) {
                    configs.push({
                        x: 150 + Math.random() * 950,
                        y: 60 + Math.random() * 140,
                        scaleX: 0.2 + Math.random() * 0.15,
                        scaleY: 0.08 + Math.random() * 0.04,
                        isFixed: false,
                    });
                }

                // Middle section (y: 220-380) - 6 platforms
                for (let i = 0; i < 6; i++) {
                    configs.push({
                        x: 150 + Math.random() * 950,
                        y: 220 + Math.random() * 160,
                        scaleX: 0.2 + Math.random() * 0.15,
                        scaleY: 0.08 + Math.random() * 0.04,
                        isFixed: false,
                    });
                }

                // Lower section (y: 400-540) - 6 platforms
                for (let i = 0; i < 6; i++) {
                    configs.push({
                        x: 150 + Math.random() * 950,
                        y: 400 + Math.random() * 140,
                        scaleX: 0.2 + Math.random() * 0.15,
                        scaleY: 0.08 + Math.random() * 0.04,
                        isFixed: false,
                    });
                }

                return configs;
            }

            // Create initial platforms
            let platformConfigs = generateRandomPlatforms();

            platformConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(config.scaleX, config.scaleY);
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                platform.setData('isFixed', config.isFixed);

                // Green for start/flag platforms, purple for others
                if (config.isFixed) {
                    platform.setTint(0x66FF66);
                } else {
                    platform.setTint(0xCC99FF);
                }
                platforms.push(platform);
            });

            // Function to randomize platforms on death
            function randomizePlatforms() {
                const newConfigs = generateRandomPlatforms();
                platforms.forEach((platform, index) => {
                    if (index < newConfigs.length) {
                        const config = newConfigs[index];
                        platform.setPosition(config.x, config.y);
                        platform.setScale(config.scaleX, config.scaleY);
                        platform.setData('isFixed', config.isFixed);
                        (platform.body as Phaser.Physics.Arcade.Body).enable = true;

                        if (config.isFixed) {
                            platform.setTint(0x66FF66);
                        } else {
                            platform.setTint(0xCC99FF);
                        }
                    }
                });
            }

            (this as any).randomizePlatforms = randomizePlatforms;

            // Create flag at bottom right corner (hardest spot with inverted gravity)
            const flag = this.physics.add.sprite(1150, 555, 'flag').setScale(0.15);
            flag.setOrigin(0.5, 0); // Origin at top since flag hangs down
            flag.setFlipY(true); // Flip the flag upside down
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player at the CEILING (top of screen), upside down
            player = this.physics.add.sprite(100, 80, 'mario');
            player.setBounce(0.1);
            player.setCollideWorldBounds(true);
            player.setFlipY(true); // Mario is upside down!
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
            platforms.forEach(platform => {
                this.physics.add.collider(player, platform);
            });

            // Add UI text for gravity revert
            cooldownText = this.add.text(20, 20, 'Press SPACE for normal gravity!', {
                fontSize: '18px',
                color: '#00ff00',
                fontFamily: 'Arial',
            });

            revertText = this.add.text(20, 50, '', {
                fontSize: '24px',
                color: '#ffff00',
                fontFamily: 'Arial',
            });

            // Flag overlap
            this.physics.add.overlap(player, flag, () => {
                if (!player.getData('hasLost') && !player.getData('hasWon')) {
                    player.setData('hasWon', true);
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

            // World bounds - lose if hit ceiling (when gravity normal) or floor (when inverted)
            this.physics.world.on(
                'worldbounds',
                (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean, left: boolean, right: boolean) => {
                    if (body.gameObject === player) {
                        // Die if floating off the wrong edge based on gravity
                        const shouldDie = (gravityInverted && up) || (!gravityInverted && down);

                        if (shouldDie && !player.getData('hasLost') && !player.getData('hasWon')) {
                            player.setData('hasLost', true);
                            player.setVelocity(0, 0);
                            player.anims.stop();
                            player.setTint(0xb22222);
                            this.add.text(600, 300, 'Game Over', {
                                fontSize: '48px',
                                color: '#ffffff',
                                fontFamily: 'Arial',
                            }).setOrigin(0.5, 0.5);

                            // Randomize platforms and reset gravity for next attempt
                            (this as any).randomizePlatforms();
                            gravityInverted = true;
                            isGravityReverted = false;
                            canUseGravityRevert = true;
                            cooldownRemaining = 0;
                            revertTimeRemaining = 0;
                            this.physics.world.gravity.y = -GRAVITY_STRENGTH;
                        }
                    }
                }
            );

            // Add hints
            this.add.text(600, 560, 'Controls INVERTED! Press SPACE for random normal gravity (1-5 sec)', {
                fontSize: '16px',
                color: '#ffcc00',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);

            this.add.text(600, 580, '15 second cooldown after use', {
                fontSize: '12px',
                color: '#aaaaaa',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0.5);
        }

        function update(this: Phaser.Scene) {
            const delta = this.game.loop.delta / 1000; // Convert to seconds

            // Update cooldown timer
            if (cooldownRemaining > 0) {
                cooldownRemaining -= delta;
                if (cooldownRemaining <= 0) {
                    cooldownRemaining = 0;
                    canUseGravityRevert = true;
                    cooldownText.setText('Press SPACE for normal gravity!');
                    cooldownText.setColor('#00ff00');
                } else {
                    cooldownText.setText(`Cooldown: ${Math.ceil(cooldownRemaining)}s`);
                    cooldownText.setColor('#ff6666');
                }
            }

            // Update gravity revert timer
            if (isGravityReverted && revertTimeRemaining > 0) {
                revertTimeRemaining -= delta;
                revertText.setText(`Normal gravity: ${Math.ceil(revertTimeRemaining)}s`);

                if (revertTimeRemaining <= 0) {
                    // Revert back to inverted gravity
                    isGravityReverted = false;
                    gravityInverted = true;
                    this.physics.world.gravity.y = -GRAVITY_STRENGTH;
                    player.setFlipY(true);
                    revertText.setText('');
                }
            }

            if (!player.body || player.getData('hasLost') || player.getData('hasWon')) return;

            const body = player.body as Phaser.Physics.Arcade.Body;

            // Check for spacebar to activate gravity revert
            if (keySpace?.isDown && canUseGravityRevert && !isGravityReverted) {
                // Random 1-5 seconds
                const duration = Math.floor(Math.random() * 5) + 1;
                revertTimeRemaining = duration;
                isGravityReverted = true;
                canUseGravityRevert = false;
                cooldownRemaining = 15; // 15 second cooldown

                // Switch to normal gravity
                gravityInverted = false;
                this.physics.world.gravity.y = GRAVITY_STRENGTH;
                player.setFlipY(false);

                revertText.setText(`Normal gravity: ${duration}s`);
                cooldownText.setText(`Cooldown: 15s`);
                cooldownText.setColor('#ff6666');
            }

            if (cursors) {
                // INVERTED CONTROLS - left is right, right is left
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(160); // Inverted: moves right
                    player.anims.play('right', true);
                }
                else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(-160); // Inverted: moves left
                    player.anims.play('left', true);
                }
                else {
                    player.setVelocityX(0);
                }

                // Jump based on current gravity direction
                if (gravityInverted) {
                    // Gravity pulls UP, so jump DOWN, check blocked.up
                    if ((cursors.up.isDown || keyW?.isDown || cursors.down.isDown || keyS?.isDown) && body.blocked.up) {
                        player.setVelocityY(350);
                    }
                } else {
                    // Gravity pulls DOWN (normal), so jump UP, check blocked.down
                    if ((cursors.up.isDown || keyW?.isDown || cursors.down.isDown || keyS?.isDown) && body.blocked.down) {
                        player.setVelocityY(-350);
                    }
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
                <h1 className="text-container">AstroMario Game - Level 11</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 11: Inverted World</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game12')}>
                            <p className="p2">12th level</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame11;
