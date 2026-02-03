import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { navigate } from 'wouter/use-browser-location';

const MarioGame10: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        // 30 degree slope - gravity pulls towards bottom-left
        const SLOPE_ANGLE = 30;
        const SLOPE_RAD = Phaser.Math.DegToRad(SLOPE_ANGLE);
        const GRAVITY_STRENGTH = 400;
        const GRAVITY_X = -Math.sin(SLOPE_RAD) * GRAVITY_STRENGTH; // -200
        const GRAVITY_Y = Math.cos(SLOPE_RAD) * GRAVITY_STRENGTH;  // 346

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 1200,
            height: 600,
            parent: gameContainerRef.current,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { x: GRAVITY_X, y: GRAVITY_Y },
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
        let fireballs: Phaser.Physics.Arcade.Sprite[] = [];
        let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
        let fireballTimer: Phaser.Time.TimerEvent;

        // WASD keys
        let keyW: Phaser.Input.Keyboard.Key | undefined;
        let keyA: Phaser.Input.Keyboard.Key | undefined;
        let keyS: Phaser.Input.Keyboard.Key | undefined;
        let keyD: Phaser.Input.Keyboard.Key | undefined;

        // Fireball settings
        const FIREBALL_SPEED = 300;
        const FIREBALL_SPAWN_INTERVAL = 500; // ms between fireballs (2 per second)

        function preload(this: Phaser.Scene) {
            this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
            this.load.image('ground', 'https://labs.phaser.io/assets/platforms/grass-tile.png');
            this.load.image('flag', '/flag.png');
            this.load.image('fireball', '/fireball.png');
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
            }

            // Rotate the background
            const bg = this.add.image(600, 300, 'sky');
            bg.setDisplaySize(1400, 800);
            bg.setAngle(-SLOPE_ANGLE);

            // Create sloped platforms - all rotated 30 degrees
            const platformConfigs = [
                // Bottom platforms (starting area)
                { x: 150, y: 550, scaleX: 1.5, scaleY: 0.15 },
                { x: 350, y: 520, scaleX: 0.8, scaleY: 0.12 },
                { x: 550, y: 480, scaleX: 0.8, scaleY: 0.12 },
                // Middle section
                { x: 200, y: 420, scaleX: 0.7, scaleY: 0.12 },
                { x: 400, y: 380, scaleX: 0.9, scaleY: 0.12 },
                { x: 650, y: 350, scaleX: 0.7, scaleY: 0.12 },
                { x: 850, y: 400, scaleX: 0.8, scaleY: 0.12 },
                // Upper section
                { x: 300, y: 280, scaleX: 0.6, scaleY: 0.12 },
                { x: 500, y: 240, scaleX: 0.7, scaleY: 0.12 },
                { x: 750, y: 200, scaleX: 0.8, scaleY: 0.12 },
                { x: 950, y: 250, scaleX: 0.7, scaleY: 0.12 },
                // Top section to flag
                { x: 600, y: 140, scaleX: 0.6, scaleY: 0.12 },
                { x: 850, y: 100, scaleX: 0.7, scaleY: 0.12 },
                { x: 1050, y: 120, scaleX: 0.8, scaleY: 0.12 },
                // Flag platform
                { x: 1120, y: 80, scaleX: 0.5, scaleY: 0.15 },
            ];

            platformConfigs.forEach((config) => {
                const platform = this.physics.add.sprite(config.x, config.y, 'ground');
                platform.setScale(config.scaleX, config.scaleY);
                platform.setAngle(-SLOPE_ANGLE); // Rotate platform
                (platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                (platform.body as Phaser.Physics.Arcade.Body).setImmovable(true);
                // Tint to show slope
                platform.setTint(0xCCAAFF);
                platforms.push(platform);
            });

            // Create flag (also rotated)
            const flag = this.physics.add.sprite(1120, 50, 'flag').setScale(0.2);
            flag.setOrigin(0.5, 1);
            flag.setAngle(-SLOPE_ANGLE);
            (flag.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

            // Create player
            player = this.physics.add.sprite(150, 480, 'mario');
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
            platforms.forEach(platform => {
                this.physics.add.collider(player, platform);
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

            // World bounds - lose if hit left or bottom
            this.physics.world.on(
                'worldbounds',
                (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean, left: boolean, right: boolean) => {
                    if (body.gameObject === player && (down || left)) {
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

            // Add slope indicator text
            this.add.text(1100, 550, '30° Slope', {
                fontSize: '20px',
                color: '#ffffff',
                fontFamily: 'Arial',
            }).setAngle(-SLOPE_ANGLE);

            // Fireball spawning - rain down at 30 degree angle
            fireballTimer = this.time.addEvent({
                delay: FIREBALL_SPAWN_INTERVAL,
                callback: () => {
                    if (player.getData('hasLost') || player.getData('hasWon')) return;

                    // Spawn from top edge at random x position (right side more likely)
                    const spawnX = 400 + Math.random() * 900; // Spawn from middle-right
                    const spawnY = -20;

                    const fireball = this.physics.add.sprite(spawnX, spawnY, 'fireball');
                    fireball.setScale(0.3);
                    fireball.setAngle(-SLOPE_ANGLE);
                    (fireball.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

                    // Move at 30 degree angle towards bottom-left
                    const velX = -Math.cos(SLOPE_RAD) * FIREBALL_SPEED;
                    const velY = Math.sin(SLOPE_RAD) * FIREBALL_SPEED + 150; // Add some downward
                    fireball.setVelocity(velX, velY);

                    fireballs.push(fireball);

                    // Overlap with player - kills Mario
                    this.physics.add.overlap(player, fireball, () => {
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
                    });
                },
                loop: true,
            });
        }

        function update(this: Phaser.Scene) {
            // Clean up off-screen fireballs
            fireballs = fireballs.filter(fireball => {
                if (fireball.x < -50 || fireball.y > 650) {
                    fireball.destroy();
                    return false;
                }
                return true;
            });

            if (!player.body || player.getData('hasLost') || player.getData('hasWon')) return;

            const body = player.body as Phaser.Physics.Arcade.Body;

            // Rotate player to match the slope when on a platform
            if (body.blocked.down) {
                player.setAngle(-SLOPE_ANGLE);
            } else {
                player.setAngle(0);
            }

            if (cursors) {
                // Movement adjusted for slope - moving right is "uphill", left is "downhill"
                if (cursors.left.isDown || keyA?.isDown) {
                    player.setVelocityX(-120); // Easier downhill
                    player.anims.play('left', true);
                } else if (cursors.right.isDown || keyD?.isDown) {
                    player.setVelocityX(200); // Harder uphill, need more force
                    player.anims.play('right', true);
                } else {
                    // Apply friction but still slide left due to gravity
                    const currentVelX = body.velocity.x;
                    player.setVelocityX(currentVelX * 0.95);
                }

                // Jump perpendicular to slope
                if ((cursors.up.isDown || keyW?.isDown) && body.blocked.down) {
                    // Jump direction adjusted for slope
                    const jumpStrength = 380;
                    const jumpX = Math.sin(SLOPE_RAD) * jumpStrength * 0.3;
                    const jumpY = -Math.cos(SLOPE_RAD) * jumpStrength;
                    player.setVelocity(body.velocity.x + jumpX, jumpY);
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
                <h1 className="text-container">AstroMario Game - Level 10</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div ref={gameContainerRef}></div>
                <div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <strong>Level 10: Sloped World</strong>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button className="button" onClick={() => navigate('game11')}>
                            <p className="p2">11th level</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarioGame10;
