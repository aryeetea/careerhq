import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const email = `bloomsmoketest+${Date.now()}@gmail.com`
const password = 'BloomSmokeTest123!'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const fallbackDescription = `
Security Analyst
Bloom Labs
Remote - New York, NY preferred
Salary: $120,000 - $145,000

Bloom Labs is hiring a Security Analyst to strengthen cloud security, incident response, SIEM monitoring, and vendor risk.

Required qualifications:
- 4+ years of security operations or incident response experience
- Experience with AWS, SIEM platforms, vulnerability management, and security investigations
- Strong written communication
- Bachelor's degree in cybersecurity, computer science, or related field

Preferred qualifications:
- Security+ or CISSP certification
- Experience building detection rules and security playbooks

Responsibilities:
- Monitor alerts and investigate incidents
- Partner with engineering on remediation
- Maintain documentation and risk assessments

Application deadline: September 30, 2026
`

const resumes = [
  {
    name: 'Jordan Security Resume.txt',
    storagePath: `smoke-tests/jordan-${Date.now()}.txt`,
    text: `
Jordan Ellis
Senior Security Analyst

Summary:
Security analyst with 6 years of experience in cloud security, SIEM monitoring, incident response, AWS security controls, vulnerability management, and cross-functional remediation.

Experience:
- Led security investigations and triage for cloud infrastructure alerts
- Built alerting and response playbooks in SIEM tooling
- Performed vendor risk reviews and documented findings

Education:
Bachelor of Science in Information Security

Certifications:
CompTIA Security+
    `,
  },
  {
    name: 'Taylor Generalist Resume.txt',
    storagePath: `smoke-tests/taylor-${Date.now()}.txt`,
    text: `
Taylor Morgan
IT Support Specialist

Summary:
IT professional with 3 years of help desk and endpoint support experience.

Experience:
- Resolved device issues
- Managed SaaS account access

Education:
Associate degree in Information Technology
    `,
  },
]

function expect(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Bloom Smoke Tester',
      },
    },
  })

  if (signUpResult.error) {
    throw signUpResult.error
  }

  const session = signUpResult.data.session
  expect(session?.access_token, 'Sign-up did not return an authenticated session')

  const authed = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
    auth: {
      persistSession: false,
    },
  })

  const userId = signUpResult.data.user?.id
  expect(userId, 'Missing user id after sign-up')

  const profileUpdate = await authed
    .from('profiles')
    .update({
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileUpdate.error) {
    throw profileUpdate.error
  }

  const insertedResumeIds = []

  for (const resume of resumes) {
    const uploadResult = await authed.storage
      .from('resumes')
      .upload(resume.storagePath, new Blob([resume.text], { type: 'text/plain' }), {
        contentType: 'text/plain',
        upsert: false,
      })

    if (uploadResult.error) {
      throw uploadResult.error
    }

    const insertResume = await authed
      .from('resumes')
      .insert({
        user_id: userId,
        name: resume.name,
        file_name: resume.name,
        file_path: resume.storagePath,
        file_size: resume.text.length,
        mime_type: 'text/plain',
        extracted_text: resume.text,
        is_active: true,
      })
      .select('id, name')
      .single()

    if (insertResume.error) {
      throw insertResume.error
    }

    insertedResumeIds.push(insertResume.data.id)
  }

  const insertJob = await authed
    .from('jobs')
    .insert({
      user_id: userId,
      title: 'Security Analyst',
      company: 'Bloom Labs',
      status: 'saved',
      url: 'https://example.invalid/security-analyst',
      job_description: fallbackDescription,
    })
    .select('id')
    .single()

  if (insertJob.error) {
    throw insertJob.error
  }

  const jobId = insertJob.data.id

  const analyzeResult = await authed.functions.invoke('analyze-job', {
    body: {
      jobId,
    },
  })

  if (analyzeResult.error) {
    throw analyzeResult.error
  }

  expect(analyzeResult.data?.job?.id === jobId, 'Analyze result did not return the expected job')
  expect(Array.isArray(analyzeResult.data?.resumeRankings), 'Analyze result missing resume rankings')
  expect(analyzeResult.data.resumeRankings.length >= 2, 'Analyze result did not rank both resumes')
  expect(analyzeResult.data?.recommendedResumeId, 'Analyze result missing recommended resume')
  expect(['green', 'yellow', 'red'].includes(analyzeResult.data?.analysis?.verdict), 'Invalid verdict')
  expect(typeof analyzeResult.data?.analysis?.fitScore === 'number', 'Missing fit score')

  const refreshedJob = await authed
    .from('jobs')
    .select('id, ai_analysis, ai_extracted_data, ai_recommended_resume_id, ai_cover_letter, ai_last_analyzed_at')
    .eq('id', jobId)
    .single()

  if (refreshedJob.error) {
    throw refreshedJob.error
  }

  expect(refreshedJob.data.ai_analysis, 'Job record missing saved ai_analysis')
  expect(refreshedJob.data.ai_extracted_data, 'Job record missing saved ai_extracted_data')
  expect(refreshedJob.data.ai_recommended_resume_id, 'Job record missing saved recommended resume')
  expect(refreshedJob.data.ai_last_analyzed_at, 'Job record missing ai_last_analyzed_at')

  const chosenResumeId = analyzeResult.data.recommendedResumeId

  const coverLetterResult = await authed.functions.invoke('generate-cover-letter', {
    body: {
      jobId,
      selectedResumeId: chosenResumeId,
    },
  })

  if (coverLetterResult.error) {
    throw coverLetterResult.error
  }

  expect(typeof coverLetterResult.data?.coverLetter === 'string', 'Missing generated cover letter')
  expect(coverLetterResult.data.coverLetter.length > 120, 'Cover letter too short')

  const jobAfterCoverLetter = await authed
    .from('jobs')
    .select('id, ai_cover_letter')
    .eq('id', jobId)
    .single()

  if (jobAfterCoverLetter.error) {
    throw jobAfterCoverLetter.error
  }

  expect(jobAfterCoverLetter.data.ai_cover_letter, 'Job record missing saved cover letter')

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId,
        jobId,
        recommendedResumeId: chosenResumeId,
        recommendedResumeName: analyzeResult.data.recommendedResumeName,
        fitScore: analyzeResult.data.analysis.fitScore,
        verdict: analyzeResult.data.analysis.verdict,
        priority: analyzeResult.data.analysis.applicationPriority,
        rankedResumes: analyzeResult.data.resumeRankings.map((resume) => ({
          resumeId: resume.resumeId,
          resumeName: resume.resumeName,
          score: resume.score,
          rationale: resume.rationale,
        })),
        coverLetterPreview: coverLetterResult.data.coverLetter.slice(0, 240),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
