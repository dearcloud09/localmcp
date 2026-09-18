import { z } from 'zod';
import { defineTool, type ModuleRegistry } from './define.js';

export function registerSkillTools(registry: ModuleRegistry): void {
  defineTool(registry, { name: 'list_skills', module: 'skills', schema: z.object({}), readOnly: true }, (_a, { skills }) => ({ skills: skills.map(({ name, description, path }) => ({ name, description, path })) }));
  defineTool(registry, { name: 'read_skill', module: 'skills', schema: z.object({ name: z.string() }), readOnly: true }, (a, { skills }) => {
    const skill = skills.find(value => value.name === a.name);
    if (!skill) throw new Error('Unknown skill');
    return skill;
  });
}
