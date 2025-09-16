import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Manglende Supabase konfiguration!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Basis øvelser der skal aktiveres først
const BASIC_EXERCISES = [
  // Bryst
  'push up', 'bench press', 'chest press', 'chest fly',
  
  // Ryg  
  'pull up', 'lat pulldown', 'barbell row', 'seated row',
  
  // Ben
  'squat', 'deadlift', 'lunge', 'leg press', 'calf raise',
  
  // Skuldre
  'shoulder press', 'lateral raise', 'rear delt fly',
  
  // Arme
  'bicep curl', 'tricep extension', 'hammer curl',
  
  // Core
  'plank', 'crunch', 'russian twist', 'mountain climber'
]

async function activateBasicExercises() {
  try {
    console.log('🎯 Aktiverer basis øvelser...\n')

    for (const exerciseName of BASIC_EXERCISES) {
      console.log(`🔍 Søger efter: "${exerciseName}"`)
      
      const { data: exercises, error: searchError } = await supabase
        .from('exercises')
        .select('id, name, exercise_id')
        .ilike('name', `%${exerciseName}%`)
        .eq('is_active', false)

      if (searchError) {
        console.error(`❌ Fejl ved søgning efter ${exerciseName}:`, searchError)
        continue
      }

      if (!exercises || exercises.length === 0) {
        console.log(`⚠️  Ingen øvelser fundet for: "${exerciseName}"`)
        continue
      }

      // Aktiver første match
      const exercise = exercises[0]
      const { error: updateError } = await supabase
        .from('exercises')
        .update({ is_active: true })
        .eq('id', exercise.id)

      if (updateError) {
        console.error(`❌ Fejl ved aktivering af ${exercise.name}:`, updateError)
      } else {
        console.log(`✅ Aktiveret: ${exercise.name} (${exercise.exercise_id})`)
      }
    }

    // Vis sammendrag
    const { data: activeCount } = await supabase
      .from('exercises')
      .select('count')
      .eq('is_active', true)

    console.log(`\n🎉 Færdig! ${activeCount?.[0]?.count || 0} øvelser er nu aktive`)
    console.log('Du kan nu teste din app med basis øvelserne! 🚀')

  } catch (error) {
    console.error('💥 Kritisk fejl:', error)
  }
}

activateBasicExercises()