export function scoreResumeMatch(result) {
  if (result.requiredSkills.length === 0 || result.responsibilities.length === 0) {
    throw new Error('At least one skill and responsibility are required to calculate a match score.');
  }
  const matchedSkills = result.requiredSkills.filter((skill) => skill.matched).length;
  const demonstratedResponsibilities = result.responsibilities.filter((item) => item.demonstrated).length;
  const skillScore = matchedSkills / result.requiredSkills.length;
  const responsibilityScore = demonstratedResponsibilities / result.responsibilities.length;
  return Math.round((skillScore * 60) + (responsibilityScore * 40));
}
