export function getDynamicSampleTasks() {
  const now = new Date();

  // Helper for dynamic formatting: e.g. "27 Aug"
  const formatDateOffset = (daysOffset) => {
    const d = new Date(now);
    d.setDate(now.getDate() + daysOffset);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
  };

  return [
    {
      id: 'task-python-lab-record',
      task_name: 'Python Lab Record',
      description: 'Submit completed experiment record and custom error handling notebook to classroom.',
      deadline: `${formatDateOffset(1)}, 11:59 PM`,
      priority: 'high',
      required_documents: ['College ID'],
      source_label: 'Python Lab Notice',
      created_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
      completed: false
    },
    {
      id: 'task-examination-form',
      task_name: 'Examination Form',
      description: 'Verify odd-semester subject codes and clear examination fee on ERP portal.',
      deadline: `${formatDateOffset(3)}, 5:00 PM`,
      priority: 'medium',
      required_documents: ['College ID', 'Fee Receipt'],
      source_label: 'Examination Section Circular',
      created_at: new Date(now.getTime() - 3600000 * 12).toISOString(),
      completed: false
    },
    {
      id: 'task-techfest-registration',
      task_name: 'TechFest Registration',
      description: 'Register 4-member hackathon and project exhibition team for annual technical symposium.',
      deadline: `${formatDateOffset(7)}, 6:00 PM`,
      priority: 'low',
      required_documents: ['College ID'],
      source_label: 'TechFest Committee',
      created_at: new Date(now.getTime() - 3600000 * 24).toISOString(),
      completed: false
    }
  ];
}

export const INITIAL_TASKS = getDynamicSampleTasks();


export const SAMPLE_NOTICES = [
  {
    title: 'Python Lab Urgent Submission',
    category: 'Urgent Lab',
    text: `*DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING*
URGENT NOTICE FOR B.TECH 3RD YEAR STUDENTS:

All students must submit Python Lab Assignment 4 (Modules, Classes & Error Handling) by tomorrow 11:59 PM sharp on Google Classroom. Late submissions will receive an immediate 50% deduction. Keep your physical College ID card ready for verification during viva session on Friday.

- Dr. Sharma (Lab Coordinator)`
  },
  {
    title: 'Exam Registration & Fee Notice',
    category: 'Exam Circular',
    text: `OFFICE OF THE CONTROLLER OF EXAMINATIONS
Ref No: COE/2026/088

Subject: Submission of Odd Semester Regular & Backlog Exam Forms

It is hereby notified that the examination portal for B.Tech Semester 5 is now active. All students are instructed to clear all pending dues and submit their Examination Fee before 28 August, 5:00 PM. 
Mandatory Documents to upload:
1. College ID Card
2. Latest Fee Receipt (Semester 5)

Failure to submit by 28 August will attract a fine of Rs 500.`
  },
  {
    title: 'Campus Placement Drive (T&P)',
    category: 'Placement Drive',
    text: `*TRAINING & PLACEMENT CELL CIRCULAR*

Attention Final Year B.Tech (CSE/IT/ECE) students:
Campus drive for TCS Ninja & Digital hiring has been announced. The registration link is live on Superset portal until 05 September.

Requirements:
- Minimum 60% throughout academics
- Upload scanned College ID and prior Internship Certificate
- Fill resume details carefully before the deadline.`
  },
  {
    title: 'Hackathon & Project Registration',
    category: 'Club Event',
    text: `*INNOVATE-X HACKATHON 2026*
Organized by IEEE Student Branch

Calling all developers and designers! Register your 4-member teams for the 36-hour offline hackathon scheduled for next month (15 September). 
No registration fee. You will need your College ID and Admission Letter during physical check-in at the main auditorium.`
  }
];

