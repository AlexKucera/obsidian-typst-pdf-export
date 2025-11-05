// Mock process.platform for cross-platform testing
Object.defineProperty(process, 'platform', {
	value: 'darwin',
	writable: true,
});
