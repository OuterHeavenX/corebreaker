export type ShipId = 'guardian' | 'striker' | 'magnetar';
export type Element = 'fire' | 'ice' | 'lightning' | 'kinetic';
export type EnemyType = 'scout' | 'armored' | 'shield' | 'repair' | 'gunship' | 'mine' | 'interceptor' | 'reflector' | 'conductive' | 'fuel' | 'prison' | 'command';
export type Rarity = 'COMMON' | 'RARE' | 'EPIC';
export interface ShipDef {
    id: ShipId;
    name: string;
    width: number;
    speed: number;
    ability: string;
    description: string;
    unlockRank: number;
}
export interface UpgradeDef {
    id: string;
    name: string;
    description: string;
    rarity: Rarity;
    maxRank: number;
    prereq?: string;
    tags: string[];
}
export interface StageDef {
    id: number;
    region: string;
    name: string;
    layout: string[];
    modifier?: string;
    objective: string;
    reward: number;
    boss?: string;
    tutorial?: string;
}
export interface Settings {
    music: number;
    sfx: number;
    shake: number;
    reducedMotion: boolean;
    highContrast: boolean;
    largeCore: boolean;
    touchSensitivity: number;
    directTouch: boolean;
    leftHanded: boolean;
    assistSpeed: boolean;
    assistWidth: boolean;
    assistBullets: boolean;
}
export interface Progress {
    version: 2;
    xp: number;
    rank: number;
    rescues: number;
    campaignBest: number;
    unlocks: string[];
    tutorials: string[];
    settings: Settings;
    records: Record<string, number>;
    selectedShip: ShipId;
    run?: RunState;
}
export interface RunState {
    mode: 'campaign' | 'quick' | 'endless' | 'daily';
    stage: number;
    shield: number;
    scrap: number;
    ship: ShipId;
    upgrades: Record<string, number>;
    elements: Element[];
    seed: number;
    claimed: string[];
    phase?: 'battle' | 'upgrade' | 'shop';
    offers?: string[];
    shopBought?: boolean;
    shopRerolls?: number;
    consumable?: boolean;
    rescued?: number;
}
