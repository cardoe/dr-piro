export interface PinRange {
    start: number;
    end: number;
}

export const getPinRange = async(): Promise<PinRange> => {
    const response = await fetch(`/api/fire/`);
    if (!response.ok) {
        return Promise.reject(new Error("Failed to read pin range"));
    }
    return await response.json();
}
export const firePin = async(pos: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pos}`);
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to fire {pos}`));
    }
}