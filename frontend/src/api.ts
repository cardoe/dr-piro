export const firePin = async(pos: number): Promise<void> => {
    const response = await fetch(`/api/fire/${pos}`);
    if (!response.ok) {
        return Promise.reject(new Error(`Failed to fire {pos}`));
    }
}