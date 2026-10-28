import Achievement from '../models/Achievement.js';
import StudentProfile from '../models/StudentProfile.js';
import { HttpError } from '../middleware/errors.js';

export async function getPublicPortfolio(portfolio) {
  const profile = await StudentProfile.findOne({ user: portfolio.student })
    .select('summary department graduationYear skills links projects resume +resume.data')
    .populate('user', 'name');
  if (!profile) throw new HttpError(404, 'Portfolio not found.');

  const achievements = portfolio.showAchievements
    ? await Achievement.find({ student: portfolio.student, status: { $in: ['verified', 'pending', 'draft'] } })
      .select('title category issuer issueDate description status')
      .sort({ issueDate: -1 })
    : [];

  return {
    name: profile.user.name,
    summary: profile.summary || '',
    department: portfolio.showDepartment ? profile.department || '' : '',
    graduationYear: portfolio.showGraduationYear ? profile.graduationYear || null : null,
    skills: portfolio.showSkills ? profile.skills.map(({ name, category }) => ({ name, category })) : [],
    links: { github: profile.links?.github || '' },
    projects: portfolio.showProjects ? profile.projects.map(({ title, description, technologies, githubUrl, demoUrl, type, organization }) => ({
      title, description, technologies, githubUrl, demoUrl, type, organization,
    })) : [],
    resumeAvailable: Boolean(portfolio.showResume && (profile.resume?.data?.length || profile.resume?.storageKey)),
    achievements: achievements.map(({ title, category, issuer, issueDate, description, status }) => ({
      title, category, issuer, issueDate, description, verified: status === 'verified',
    })),
  };
}
