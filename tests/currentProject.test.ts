import { describe, it, expect } from 'vitest';
import { pickProject } from '@/lib/currentProject';

describe('pickProject', () => {
    const projects = [{ id: 'prj_a' }, { id: 'prj_b' }];
    it('uses the cookie when it names an accessible project', () => {
        expect(pickProject(projects, 'prj_b')?.id).toBe('prj_b');
    });
    it('falls back to the first project for unknown or missing cookies', () => {
        expect(pickProject(projects, 'prj_other')?.id).toBe('prj_a');
        expect(pickProject(projects, undefined)?.id).toBe('prj_a');
    });
    it('returns null with no projects', () => {
        expect(pickProject([], 'prj_a')).toBeNull();
    });
});
