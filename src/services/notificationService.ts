import { supabase } from '../integrations/supabase/client'

export const createNotification = async (
  complaintId: string,
  complaintCode: string,
  stage: 'confirmation' | 'acknowledgement' | 'resolution',
  message: string,
  userId?: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        complaint_id: complaintId,
        complaint_code: complaintCode,
        stage,
        message,
        user_id: userId || 'anonymous',
        is_read: false
      })

    if (error) {
      console.error('Error creating notification:', error)
    }
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

export const createComplaintNotifications = async (complaintId: string, complaintCode: string, issueType: string) => {
  // Confirmation notification
  await createNotification(
    complaintId,
    complaintCode,
    'confirmation',
    `Your complaint ${complaintCode} for ${issueType} has been registered successfully. We will review it shortly.`,
    'anonymous'
  )

  // Acknowledgement notification (simulated delay)
  setTimeout(async () => {
    await createNotification(
      complaintId,
      complaintCode,
      'acknowledgement',
      `Your complaint ${complaintCode} has been acknowledged and assigned to the appropriate department.`,
      'anonymous'
    )
  }, 5000) // 5 seconds delay

  // Resolution notification (simulated delay)
  setTimeout(async () => {
    await createNotification(
      complaintId,
      complaintCode,
      'resolution',
      `Your complaint ${complaintCode} has been resolved. Thank you for your patience.`,
      'anonymous'
    )
  }, 30000) // 30 seconds delay
}
