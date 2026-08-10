import { IconRegistry } from '@iyulab/components';

const bundle = new Map<string, string>(
  Object.entries(import.meta.glob('./assets/icons/*.svg', {
    eager: true,
    query: '?raw',
    import: 'default',
  }))
  .map(([path, module]) => {
    const name = path.split('/').pop()?.replace('.svg', '') || '';
    return [name, module as string] as [string, string];
  })
  .filter(([name]) => name !== ''),
);

IconRegistry.register('house', (name: string) => bundle.get(name));
