// biometricService — mock
export default { isAvailable: () => Promise.resolve(false), authenticate: () => Promise.resolve({ success: false }), getType: () => Promise.resolve(null) };
