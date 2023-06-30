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

export const setDuration = async(duration: number): Promise<PinConfig> => {
    const response = await fetch(`/api/fire/`, {
        method: "PATCH",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({duration: duration}),
    });
    if (!response.ok) {
        return Promise.reject(new Error("Failed to edit duration"));
    }
    return await response.json();
}

export const firePin = async(pos: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pos}`);
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to fire ${pos}`));
    }
}

export const enablePin = async(pin: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pin}`, {method: "PUT"});
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to enable pin ${pin}`));
    }
}

export const disablePin = async(pin: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pin}`, {method: "DELETE"});
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to disable pin ${pin}`));
    }
}