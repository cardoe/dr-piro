export interface PinConfig {
    pins: Array<number>;
    duration: number;
}

export const getPinConfig = async(): Promise<PinConfig> => {
    const response = await fetch(`/api/fire/`);
    if (!response.ok) {
        return Promise.reject(new Error("Failed to read pin config"));
    }
    return await response.json();
}
export const firePin = async(pos: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pos}`);
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to fire {pos}`));
    }
}