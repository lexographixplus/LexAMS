-- Add missing DELETE policies for authenticated users

create policy "Authenticated users can delete activities"
  on public.activities for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete participants"
  on public.participants for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete registrations"
  on public.registrations for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete attendance"
  on public.attendance for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete certificates"
  on public.certificates for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete surveys"
  on public.surveys for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete survey questions"
  on public.survey_questions for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete survey responses"
  on public.survey_responses for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete assessments"
  on public.assessments for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete assessment questions"
  on public.assessment_questions for delete
  to authenticated
  using (true);

create policy "Authenticated users can delete assessment submissions"
  on public.assessment_submissions for delete
  to authenticated
  using (true);
