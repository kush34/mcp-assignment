export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`${label} timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            timer.unref?.();
        })
    ]);
}
