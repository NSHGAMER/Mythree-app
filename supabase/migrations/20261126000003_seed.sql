-- Mythree – संस्कृतगृहम्
-- 0003: default settings, badges, FAQ knowledge base and a STARTER curriculum.
-- The starter chapters are beginner Sanskrit placeholders so the platform is usable on day one.
-- Admins should edit/replace them to match the organisation's printed textbook.

insert into public.app_settings (id, suggested_contribution, programme_days, maintenance_message)
values (1, 151, 180, 'Mythree is being updated. Please check back shortly.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------------
insert into public.badges (code, name, name_sanskrit, description, icon, criteria, threshold, xp_bonus, tier, sort_order) values
  ('first_chapter', 'First Step', 'प्रथमं पदम्', 'Complete your first chapter test.', 'footprints', 'chapters', 1, 10, 'bronze', 10),
  ('chapters_3', 'Steady Learner', 'स्थिराभ्यासी', 'Complete three chapters.', 'book-open', 'chapters', 3, 20, 'bronze', 20),
  ('chapters_6', 'Halfway Scholar', 'अर्धमार्गः', 'Complete six chapters.', 'milestone', 'chapters', 6, 40, 'silver', 30),
  ('all_chapters', 'Granthapūrṇa', 'ग्रन्थपूर्णः', 'Complete every chapter of the programme.', 'graduation-cap', 'all_chapters', 1, 150, 'platinum', 40),
  ('streak_3', 'Kindled Lamp', 'दीपप्रज्वलनम्', 'Keep a 3-day learning streak.', 'flame', 'streak', 3, 10, 'bronze', 50),
  ('streak_7', 'Week of Devotion', 'सप्ताहनिष्ठा', 'Keep a 7-day learning streak.', 'flame', 'streak', 7, 30, 'silver', 60),
  ('streak_30', 'Month of Tapas', 'मासतपः', 'Keep a 30-day learning streak.', 'flame', 'streak', 30, 100, 'gold', 70),
  ('streak_100', 'Akhaṇḍa Dīpa', 'अखण्डदीपः', 'Keep a 100-day learning streak.', 'sun', 'streak', 100, 300, 'platinum', 80),
  ('xp_500', 'Rising Star', 'उदयतारा', 'Earn 500 XP.', 'star', 'xp', 500, 0, 'bronze', 90),
  ('xp_2000', 'Bright Mind', 'प्रज्ञावान्', 'Earn 2,000 XP.', 'sparkles', 'xp', 2000, 0, 'silver', 100),
  ('xp_5000', 'Lamp of Learning', 'विद्यादीपः', 'Earn 5,000 XP.', 'lamp', 'xp', 5000, 0, 'gold', 110),
  ('daily_7', 'Daily Practice', 'नित्याभ्यासः', 'Complete 7 daily challenges.', 'calendar-check', 'daily', 7, 20, 'bronze', 120),
  ('daily_30', 'Sādhaka', 'साधकः', 'Complete 30 daily challenges.', 'calendar-heart', 'daily', 30, 60, 'silver', 130),
  ('daily_100', 'Nitya Sādhaka', 'नित्यसाधकः', 'Complete 100 daily challenges.', 'calendar-range', 'daily', 100, 150, 'gold', 140),
  ('weekly_1', 'Weekly Victor', 'साप्ताहिकविजयी', 'Pass your first weekly challenge.', 'trophy', 'weekly', 1, 20, 'bronze', 150),
  ('weekly_10', 'Champion of Ten Weeks', 'दशविजयी', 'Pass 10 weekly challenges.', 'trophy', 'weekly', 10, 100, 'gold', 160),
  ('perfect_1', 'Flawless', 'निर्दोषः', 'Score 100% in a chapter test.', 'target', 'perfect', 1, 15, 'silver', 170),
  ('perfect_5', 'Master of Precision', 'शुद्धिप्रवीणः', 'Score 100% in five chapter tests.', 'crosshair', 'perfect', 5, 75, 'gold', 180),
  ('exam_ready', 'Ready for Parīkṣā', 'परीक्षासिद्धः', 'Declare readiness for the final exam.', 'scroll-text', 'exam_ready', 1, 50, 'platinum', 190)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- FAQ knowledge base (editable from the admin dashboard)
-- ---------------------------------------------------------------------------
insert into public.faqs (question, answer, keywords, category, sort_order) values
  ('How does the Mythree learning programme work?',
   'You receive a printed Sanskrit textbook at your registered address. Read one chapter at a time from the book, then open that chapter in the Mythree app and take its chapter test. When you reach the pass mark, the chapter is marked complete and the next chapter unlocks.',
   array['programme','how','work','start','learning','process','procedure'], 'Learning', 10),
  ('How long is the programme? What happens after 180 days?',
   'The recommended target is 180 days, but it is only a guide. You can finish earlier or take longer. Your learning is never locked or reset after 180 days and all your progress is kept.',
   array['180','days','duration','deadline','late','time','limit','longer'], 'Learning', 20),
  ('When is a chapter marked as completed?',
   'A chapter is completed when you score at least the pass percentage shown on the chapter (usually 70%) in its chapter test. You can retake a test as many times as you need.',
   array['complete','completed','pass','mark','percentage','chapter'], 'Learning', 30),
  ('Can I retake a chapter test?',
   'Yes. You can retake any chapter test. Your best score is kept. XP for passing a chapter is awarded once, the first time you pass.',
   array['retake','again','retry','repeat','attempt','test'], 'Tests', 40),
  ('What are daily and weekly challenges?',
   'Each day you get a short daily challenge of a few questions from chapters you have studied. Each week there is a longer weekly challenge. Both earn XP and help you keep your streak.',
   array['daily','weekly','challenge','challenges'], 'Challenges', 50),
  ('What is XP and how do I earn it?',
   'XP (experience points) measure your learning effort. You earn XP for passing chapter tests, perfect scores, daily challenges, weekly challenges and earning badges. All XP is calculated by the server.',
   array['xp','points','score','earn','level'], 'Rewards', 60),
  ('What is a streak?',
   'Your streak counts how many days in a row you have done some learning activity (a chapter test or a challenge). Missing a full day resets the streak, so try to practise a little every day.',
   array['streak','fire','days','row','continuous'], 'Rewards', 70),
  ('How does the leaderboard work?',
   'The leaderboard ranks members by XP, for all time and for the current week. Only your first name and initial are shown. You can hide yourself from the leaderboard in Account Settings.',
   array['leaderboard','rank','ranking','position','hide'], 'Rewards', 80),
  ('What is Guru Dakshina? Is it compulsory?',
   'Guru Dakshina is a completely voluntary contribution to support the organisation. It is not a fee. You can register, learn, take tests, earn rewards and take the final exam without contributing anything.',
   array['guru','dakshina','payment','fee','pay','money','contribution','compulsory','mandatory','donate','donation','free','cost','charge','price'], 'Guru Dakshina', 90),
  ('How do I get a receipt for my Guru Dakshina?',
   'After a successful contribution, open Guru Dakshina and choose Contribution history. Each successful payment has a receipt you can view and print.',
   array['receipt','invoice','history','transaction','payment'], 'Guru Dakshina', 100),
  ('My payment failed or money was deducted. What should I do?',
   'A contribution is shown as successful only after it is verified with the payment gateway. If money was deducted but it is not shown as successful, wait 30 minutes and refresh. If it still does not appear, contact us with the date and amount.',
   array['failed','deducted','refund','payment','problem','pending'], 'Guru Dakshina', 110),
  ('How do I take the final exam?',
   'When you complete all chapters, the button "Yes, I am ready to take the Final Exam" appears on your dashboard. After you confirm, the organisation is notified and the final exam question paper is sent by post to your registered address. There is no online final exam.',
   array['final','exam','examination','paper','ready','readiness','certificate'], 'Final Exam', 120),
  ('How do I change my address or phone number?',
   'Open Account Settings from your profile. You can update your name, phone number and address there. If you change your phone number you will need to verify it again. Make sure your address is correct before requesting the final exam.',
   array['address','change','update','phone','mobile','edit','profile'], 'Account', 130),
  ('I forgot my password. How do I reset it?',
   'On the login page choose "Forgot password", enter your registered email and follow the link we send you to set a new password.',
   array['forgot','password','reset','login','sign','cannot'], 'Account', 140),
  ('I did not receive the verification email.',
   'Check your spam or promotions folder. You can request a new verification email from the login page. Make sure you registered with the correct email address.',
   array['verification','verify','email','confirm','received','link'], 'Account', 150),
  ('How do I install the Mythree app on my phone?',
   'On Android, open Mythree in Chrome and tap "Install app" (or the menu, then "Add to Home screen"). On iPhone, open Mythree in Safari, tap the Share button, then "Add to Home Screen".',
   array['install','app','phone','android','iphone','home','screen','download','mobile'], 'App', 160),
  ('When will I receive the textbook?',
   'The organisation posts the printed textbook to your registered residential address. Please keep your address up to date in Account Settings. For delivery questions, please contact us.',
   array['textbook','book','delivery','receive','post','courier'], 'Learning', 170)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Starter curriculum
-- ---------------------------------------------------------------------------
create or replace function pg_temp.add_chapter(p_pos integer, p_title text, p_sa text, p_desc text, p_ref text, p_obj text[])
returns uuid language sql as $$
  insert into public.chapters (position, title, title_sanskrit, description, textbook_reference, learning_objectives, is_published)
  values (p_pos, p_title, p_sa, p_desc, p_ref, p_obj, true) returning id;
$$;

create or replace function pg_temp.add_q(p_pos integer, p_type public.question_type, p_prompt text, p_options jsonb, p_answers text[], p_expl text)
returns void language plpgsql as $$
declare v_ch uuid; v_q uuid; v_opts jsonb := p_options; v_ans text[] := p_answers;
begin
  select id into v_ch from public.chapters where position = p_pos;
  -- Shuffle MCQ options so the correct answer is not always in the same place.
  if p_type = 'mcq' then
    with opts as materialized (
      select o.value, o.ord - 1 as idx, random() as r from jsonb_array_elements(p_options) with ordinality o(value, ord)
    ), ranked as (
      select value, idx, row_number() over (order by r) - 1 as pos from opts
    )
    select jsonb_agg(value order by pos), array[(select pos::text from ranked where idx = p_answers[1]::integer)]
      into v_opts, v_ans from ranked;
  end if;
  p_answers := v_ans;
  insert into public.questions (chapter_id, type, prompt, options, position)
  values (v_ch, p_type, p_prompt, case when p_type = 'true_false' then '["True","False"]'::jsonb else v_opts end,
          (select count(*) from public.questions where chapter_id = v_ch))
  returning id into v_q;
  insert into public.question_keys (question_id, accepted_answers, explanation) values (v_q, p_answers, p_expl);
end $$;

do $$
begin
  if exists (select 1 from public.chapters) then return; end if;

  perform pg_temp.add_chapter(1, 'The Sanskrit Alphabet', 'वर्णमाला', 'Vowels, consonants and the order of the Devanāgarī alphabet.', 'Textbook Chapter 1', array['Recognise vowels and consonants', 'Know the vargas (groups) of consonants']);
  perform pg_temp.add_chapter(2, 'Greetings and Introductions', 'सम्भाषणम्', 'Everyday greetings and introducing yourself in Sanskrit.', 'Textbook Chapter 2', array['Greet people', 'Introduce yourself', 'Ask someone''s name']);
  perform pg_temp.add_chapter(3, 'Pronouns', 'सर्वनामानि', 'He, she, it, I and you in Sanskrit.', 'Textbook Chapter 3', array['Use सः, सा, तत्', 'Use अहम् and त्वम्']);
  perform pg_temp.add_chapter(4, 'Masculine a-ending Nouns', 'अकारान्तपुंलिङ्गशब्दाः', 'Singular, dual and plural of nouns like राम and बालक.', 'Textbook Chapter 4', array['Form singular, dual and plural', 'Recognise the accusative']);
  perform pg_temp.add_chapter(5, 'Feminine and Neuter Nouns', 'स्त्रीलिङ्गनपुंसकलिङ्गशब्दाः', 'Nouns like बाला, लता and फलम्.', 'Textbook Chapter 5', array['Identify gender', 'Form plurals of feminine and neuter nouns']);
  perform pg_temp.add_chapter(6, 'Present Tense', 'लट् लकारः', 'Describing actions happening now.', 'Textbook Chapter 6', array['Conjugate verbs in the present tense', 'Match verb with subject']);
  perform pg_temp.add_chapter(7, 'Numbers', 'संख्याः', 'Counting in Sanskrit.', 'Textbook Chapter 7', array['Count from one to ten', 'Recognise numerals']);
  perform pg_temp.add_chapter(8, 'Cases', 'विभक्तयः', 'The seven cases and how word endings change meaning.', 'Textbook Chapter 8', array['Identify the seven vibhaktis', 'Understand case meanings']);
  perform pg_temp.add_chapter(9, 'Indeclinables', 'अव्ययानि', 'Words that never change form: here, there, where, when.', 'Textbook Chapter 9', array['Use common avyayas', 'Ask simple questions']);
  perform pg_temp.add_chapter(10, 'Future Tense', 'लृट् लकारः', 'Talking about what will happen.', 'Textbook Chapter 10', array['Form the future tense', 'Use future verbs in sentences']);
  perform pg_temp.add_chapter(11, 'Past Tense', 'लङ् लकारः', 'Talking about what happened.', 'Textbook Chapter 11', array['Form the past tense', 'Recognise the augment अ']);
  perform pg_temp.add_chapter(12, 'Introduction to Sandhi', 'सन्धिः', 'How sounds join when words meet.', 'Textbook Chapter 12', array['Recognise दीर्घ, गुण, वृद्धि and यण् sandhi']);

  -- 1 वर्णमाला
  perform pg_temp.add_q(1, 'mcq', 'Which of these is a vowel (स्वरः)?', '["क","इ","म","त"]', array['1'], 'इ is a vowel. क, म and त are consonants (व्यञ्जनानि).');
  perform pg_temp.add_q(1, 'mcq', 'Which script is most commonly used to write Sanskrit today?', '["Devanāgarī","Gurmukhi","Arabic","Latin only"]', array['0'], 'Sanskrit is most commonly written in Devanāgarī, though regional scripts are also used.');
  perform pg_temp.add_q(1, 'true_false', 'क is a consonant (व्यञ्जनम्).', '[]', array['true'], 'क is the first consonant of the कवर्ग.');
  perform pg_temp.add_q(1, 'mcq', 'Which of these is a long vowel (दीर्घः स्वरः)?', '["अ","इ","ऊ","उ"]', array['2'], 'ऊ is the long form of उ.');
  perform pg_temp.add_q(1, 'mcq', 'Which group is the कवर्ग?', '["क ख ग घ ङ","च छ ज झ ञ","ट ठ ड ढ ण","प फ ब भ म"]', array['0'], 'The कवर्ग is the guttural group क ख ग घ ङ.');
  perform pg_temp.add_q(1, 'fill_blank', 'Write the vowel that comes right after अ in the alphabet.', '[]', array['आ','aa','ā'], 'The order begins अ, आ, इ, ई …');

  -- 2 सम्भाषणम्
  perform pg_temp.add_q(2, 'mcq', 'What does "नमस्ते" mean?', '["Greetings to you","Thank you","Goodbye","Sorry"]', array['0'], 'नमस्ते is a respectful greeting.');
  perform pg_temp.add_q(2, 'mcq', 'How do you say "My name is …"?', '["मम नाम …","तव नाम …","अहं गच्छामि","सः कः"]', array['0'], 'मम = my, नाम = name.');
  perform pg_temp.add_q(2, 'mcq', '"भवतः नाम किम्?" asks:', '["What is your name?","Where are you going?","How are you?","What is this?"]', array['0'], 'भवतः नाम किम् = What is your (respectful) name?');
  perform pg_temp.add_q(2, 'mcq', 'What does "धन्यवादः" mean?', '["Thank you","Welcome","Good night","Please"]', array['0'], 'धन्यवादः expresses thanks.');
  perform pg_temp.add_q(2, 'true_false', '"सुप्रभातम्" is a greeting used in the morning.', '[]', array['true'], 'सुप्रभातम् = Good morning.');
  perform pg_temp.add_q(2, 'mcq', 'Which word means "yes"?', '["आम्","न","कुत्र","किम्"]', array['0'], 'आम् = yes, न = no.');

  -- 3 सर्वनामानि
  perform pg_temp.add_q(3, 'mcq', '"सः" means:', '["he","she","it","I"]', array['0'], 'सः is the masculine pronoun "he/that".');
  perform pg_temp.add_q(3, 'mcq', '"सा" means:', '["she","he","you","we"]', array['0'], 'सा is the feminine pronoun "she/that".');
  perform pg_temp.add_q(3, 'mcq', '"अहम्" means:', '["I","you","he","they"]', array['0'], 'अहम् = I.');
  perform pg_temp.add_q(3, 'mcq', '"त्वम्" means:', '["you (one person)","we","they","she"]', array['0'], 'त्वम् = you (singular).');
  perform pg_temp.add_q(3, 'true_false', '"तत्" is used for neuter things (it/that).', '[]', array['true'], 'तत् is the neuter form.');
  perform pg_temp.add_q(3, 'fill_blank', 'Write the Sanskrit word for "I".', '[]', array['अहम्','अहं','aham'], 'अहम् = I.');

  -- 4 अकारान्तपुंलिङ्गशब्दाः
  perform pg_temp.add_q(4, 'mcq', 'Nominative singular of राम is:', '["रामः","रामौ","रामाः","रामम्"]', array['0'], 'प्रथमा एकवचनम् = रामः.');
  perform pg_temp.add_q(4, 'mcq', '"बालकाः" is in which number?', '["Plural (three or more)","Dual","Singular","None"]', array['0'], 'बालकाः = boys (plural).');
  perform pg_temp.add_q(4, 'mcq', 'Nominative dual of बालक is:', '["बालकौ","बालकाः","बालकम्","बालकः"]', array['0'], 'द्विवचनम् = बालकौ (two boys).');
  perform pg_temp.add_q(4, 'true_false', 'Sanskrit has three numbers: singular, dual and plural.', '[]', array['true'], 'एकवचनम्, द्विवचनम्, बहुवचनम्.');
  perform pg_temp.add_q(4, 'mcq', '"रामम्" is in which case?', '["द्वितीया (accusative)","प्रथमा (nominative)","तृतीया (instrumental)","षष्ठी (genitive)"]', array['0'], 'रामम् is द्वितीया एकवचनम्.');
  perform pg_temp.add_q(4, 'fill_blank', 'Write the nominative plural of राम.', '[]', array['रामाः','ramah','rāmāḥ','ramaah'], 'प्रथमा बहुवचनम् = रामाः.');

  -- 5 स्त्रीलिङ्गनपुंसकलिङ्गशब्दाः
  perform pg_temp.add_q(5, 'mcq', 'What is the gender of "बाला"?', '["Feminine","Masculine","Neuter","None"]', array['0'], 'बाला (girl) is feminine.');
  perform pg_temp.add_q(5, 'mcq', 'What is the gender of "फलम्"?', '["Neuter","Masculine","Feminine","None"]', array['0'], 'फलम् (fruit) is neuter.');
  perform pg_temp.add_q(5, 'mcq', 'Nominative plural of फल is:', '["फलानि","फलाः","फले","फलम्"]', array['0'], 'Neuter plural: फलानि.');
  perform pg_temp.add_q(5, 'mcq', 'Nominative dual of बाला is:', '["बाले","बालाः","बालौ","बालाम्"]', array['0'], 'Feminine ā-stem dual: बाले.');
  perform pg_temp.add_q(5, 'true_false', '"पुस्तकम्" is a masculine noun.', '[]', array['false'], 'पुस्तकम् (book) is neuter.');
  perform pg_temp.add_q(5, 'mcq', 'Nominative plural of लता is:', '["लताः","लते","लतानि","लताम्"]', array['0'], 'Feminine ā-stem plural: लताः.');

  -- 6 लट् लकारः
  perform pg_temp.add_q(6, 'mcq', '"सः पठति" means:', '["He reads","He read","He will read","Let him read"]', array['0'], 'पठति is present tense.');
  perform pg_temp.add_q(6, 'mcq', 'How do you say "I go"?', '["अहं गच्छामि","अहं गच्छति","अहं गच्छसि","अहं गच्छन्ति"]', array['0'], 'With अहम् the verb ends in -आमि.');
  perform pg_temp.add_q(6, 'mcq', 'Complete: त्वं ___ (you write)', '["लिखसि","लिखामि","लिखति","लिखन्ति"]', array['0'], 'With त्वम् the verb ends in -सि.');
  perform pg_temp.add_q(6, 'mcq', 'Complete: ते ___ (they go)', '["गच्छन्ति","गच्छति","गच्छामः","गच्छसि"]', array['0'], 'Third person plural ends in -न्ति.');
  perform pg_temp.add_q(6, 'true_false', '"वयं पठामः" means "we read".', '[]', array['true'], 'वयम् + पठामः = we read.');
  perform pg_temp.add_q(6, 'fill_blank', 'Complete: सः ___ (he goes)', '[]', array['गच्छति','gacchati','gachchati'], 'सः गच्छति = he goes.');

  -- 7 संख्याः
  perform pg_temp.add_q(7, 'mcq', '"एकम्" means:', '["one","two","three","ten"]', array['0'], 'एकम् = 1.');
  perform pg_temp.add_q(7, 'mcq', '"पञ्च" means:', '["five","four","six","seven"]', array['0'], 'पञ्च = 5.');
  perform pg_temp.add_q(7, 'mcq', '"दश" means:', '["ten","nine","eight","twenty"]', array['0'], 'दश = 10.');
  perform pg_temp.add_q(7, 'mcq', '"त्रीणि" means:', '["three","two","four","one"]', array['0'], 'त्रीणि = 3 (neuter form).');
  perform pg_temp.add_q(7, 'true_false', '"सप्त" means seven.', '[]', array['true'], 'सप्त = 7.');
  perform pg_temp.add_q(7, 'fill_blank', 'Write the Sanskrit word for "two".', '[]', array['द्वे','द्वौ','द्वि','dve','dvau','dvi'], 'द्वौ (masculine), द्वे (feminine/neuter).');

  -- 8 विभक्तयः
  perform pg_temp.add_q(8, 'mcq', '"रामेण" (by Rāma) is in which case?', '["तृतीया","द्वितीया","चतुर्थी","सप्तमी"]', array['0'], 'तृतीया = instrumental, "by/with".');
  perform pg_temp.add_q(8, 'mcq', '"रामाय" (for Rāma) is in which case?', '["चतुर्थी","पञ्चमी","षष्ठी","प्रथमा"]', array['0'], 'चतुर्थी = dative, "for/to".');
  perform pg_temp.add_q(8, 'mcq', '"रामात्" (from Rāma) is in which case?', '["पञ्चमी","तृतीया","सप्तमी","द्वितीया"]', array['0'], 'पञ्चमी = ablative, "from".');
  perform pg_temp.add_q(8, 'mcq', '"रामस्य" (of Rāma) is in which case?', '["षष्ठी","चतुर्थी","पञ्चमी","प्रथमा"]', array['0'], 'षष्ठी = genitive, "of".');
  perform pg_temp.add_q(8, 'mcq', '"रामे" (in Rāma) is in which case?', '["सप्तमी","षष्ठी","तृतीया","द्वितीया"]', array['0'], 'सप्तमी = locative, "in/on".');
  perform pg_temp.add_q(8, 'true_false', 'There are seven विभक्तयः, plus the सम्बोधन (vocative).', '[]', array['true'], 'प्रथमा to सप्तमी, and सम्बोधनम्.');

  -- 9 अव्ययानि
  perform pg_temp.add_q(9, 'mcq', '"अत्र" means:', '["here","there","where?","when?"]', array['0'], 'अत्र = here.');
  perform pg_temp.add_q(9, 'mcq', '"तत्र" means:', '["there","here","now","also"]', array['0'], 'तत्र = there.');
  perform pg_temp.add_q(9, 'mcq', '"कुत्र" means:', '["where?","when?","why?","who?"]', array['0'], 'कुत्र = where?');
  perform pg_temp.add_q(9, 'mcq', '"कदा" means:', '["when?","where?","how?","what?"]', array['0'], 'कदा = when?');
  perform pg_temp.add_q(9, 'true_false', 'अव्ययानि change their form with gender and number.', '[]', array['false'], 'अव्यय literally means "unchanging".');
  perform pg_temp.add_q(9, 'mcq', '"अपि" means:', '["also","not","only","but"]', array['0'], 'अपि = also/too.');

  -- 10 लृट् लकारः
  perform pg_temp.add_q(10, 'mcq', '"सः पठिष्यति" means:', '["He will read","He reads","He read","Let him read"]', array['0'], '-ष्यति marks the future.');
  perform pg_temp.add_q(10, 'mcq', '"अहं गमिष्यामि" means:', '["I will go","I go","I went","I should go"]', array['0'], 'गमिष्यामि = I will go.');
  perform pg_temp.add_q(10, 'mcq', 'Future tense of "सः लिखति" is:', '["सः लेखिष्यति","सः लिखति","सः अलिखत्","सः लिखतु"]', array['0'], 'लिख् → लेखिष्यति.');
  perform pg_temp.add_q(10, 'true_false', 'लृट् लकार is used for the future tense.', '[]', array['true'], 'लृट् = simple future.');
  perform pg_temp.add_q(10, 'mcq', 'Complete: वयं ___ (we will go)', '["गमिष्यामः","गमिष्यन्ति","गच्छामः","गमिष्यसि"]', array['0'], 'First person plural future: गमिष्यामः.');
  perform pg_temp.add_q(10, 'mcq', '"भविष्यति" means:', '["will be","was","is","let it be"]', array['0'], 'भू → भविष्यति (will be).');

  -- 11 लङ् लकारः
  perform pg_temp.add_q(11, 'mcq', '"सः अपठत्" means:', '["He read (past)","He reads","He will read","Let him read"]', array['0'], 'अपठत् is past tense.');
  perform pg_temp.add_q(11, 'mcq', 'Complete: अहं ___ (I went)', '["अगच्छम्","अगच्छत्","गच्छामि","गमिष्यामि"]', array['0'], 'First person singular past: अगच्छम्.');
  perform pg_temp.add_q(11, 'mcq', 'Complete: ते ___ (they went)', '["अगच्छन्","अगच्छत्","गच्छन्ति","अगच्छाम"]', array['0'], 'Third person plural past: अगच्छन्.');
  perform pg_temp.add_q(11, 'true_false', 'लङ् लकार expresses the past tense.', '[]', array['true'], 'लङ् = imperfect (past).');
  perform pg_temp.add_q(11, 'mcq', 'Which sound is added at the start of a लङ् verb?', '["अ","इ","उ","ए"]', array['0'], 'The augment अ: पठति → अपठत्.');
  perform pg_temp.add_q(11, 'fill_blank', 'Past tense of "सः पठति": सः ___', '[]', array['अपठत्','apathat'], 'सः अपठत् = he read.');

  -- 12 सन्धिः
  perform pg_temp.add_q(12, 'mcq', 'विद्या + आलयः =', '["विद्यालयः","विद्याआलयः","विद्येलयः","विद्यौलयः"]', array['0'], 'आ + आ = आ (दीर्घ सन्धि).');
  perform pg_temp.add_q(12, 'mcq', 'देव + इन्द्रः =', '["देवेन्द्रः","देवीन्द्रः","देवैन्द्रः","देवइन्द्रः"]', array['0'], 'अ + इ = ए (गुण सन्धि).');
  perform pg_temp.add_q(12, 'mcq', 'सदा + एव =', '["सदैव","सदेव","सदाएव","सदौव"]', array['0'], 'आ + ए = ऐ (वृद्धि सन्धि).');
  perform pg_temp.add_q(12, 'mcq', 'इति + आदि =', '["इत्यादि","इतीआदि","इतेदि","इत्यदि"]', array['0'], 'इ + आ = या (यण् सन्धि).');
  perform pg_temp.add_q(12, 'true_false', 'Sandhi is the joining of sounds where two words meet.', '[]', array['true'], 'सन्धि = joining.');
  perform pg_temp.add_q(12, 'mcq', 'Which type of sandhi forms विद्यालयः?', '["दीर्घ","गुण","वृद्धि","यण्"]', array['0'], 'Two similar vowels merge into a long vowel: दीर्घ.');
end $$;
