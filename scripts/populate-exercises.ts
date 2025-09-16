import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import path from 'path'

interface ExerciseData {
  exerciseId: string
  name: string
  gifUrl: string
  targetMuscles: string[]
  bodyParts: string[]
  equipments: string[]
  secondaryMuscles: string[]
  instructions: string[]
}

interface DatabaseExercise {
  exercise_id: string
  name: string
  gif_path: string
  target_muscles: string[]
  body_parts: string[]
  equipments: string[]
  secondary_muscles: string[]
  instructions: string[]
  is_active: boolean
}

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Manglende Supabase konfiguration!')
  console.error('Sørg for at have VITE_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i din .env fil')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function loadExercisesFromJSON(): Promise<ExerciseData[]> {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'data', 'exercises.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const exercises = JSON.parse(fileContent) as ExerciseData[]
    
    console.log(`📚 Læste ${exercises.length} øvelser fra JSON fil`)
    return exercises
  } catch (error) {
    console.error('❌ Fejl ved læsning af exercises.json:', error)
    throw error
  }
}

function mapExerciseToDatabase(exercise: ExerciseData): DatabaseExercise {
  // Ekstrahér exerciseId fra gifUrl for at lave gif_path
  // Antager at gifUrl indeholder exerciseId som filename
  const gifFileName = `${exercise.exerciseId}.gif`
  const gif_path = `gifs/${gifFileName}`

  return {
    exercise_id: exercise.exerciseId,
    name: exercise.name,
    gif_path: gif_path,
    target_muscles: exercise.targetMuscles || [],
    body_parts: exercise.bodyParts || [],
    equipments: exercise.equipments || [],
    secondary_muscles: exercise.secondaryMuscles || [],
    instructions: exercise.instructions || [],
    is_active: false // Alle øvelser starter som inaktive
  }
}

async function insertExercisesInBatches(exercises: DatabaseExercise[], batchSize = 100) {
  let insertedCount = 0
  let errorCount = 0

  console.log(`🚀 Starter indsættelse af ${exercises.length} øvelser i batches af ${batchSize}`)

  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize)
    
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert(batch)
        .select('exercise_id')

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} fejlede:`, error.message)
        errorCount += batch.length
      } else {
        insertedCount += batch.length
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} gennemført: ${batch.length} øvelser`)
      }
    } catch (error) {
      console.error(`❌ Uventet fejl i batch ${Math.floor(i / batchSize) + 1}:`, error)
      errorCount += batch.length
    }

    // Lille pause mellem batches for at være venlig mod Supabase
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { insertedCount, errorCount }
}

async function checkExistingExercises(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('exercise_id')

    if (error) {
      console.error('❌ Fejl ved tjek af eksisterende øvelser:', error)
      return []
    }

    return data?.map(ex => ex.exercise_id) || []
  } catch (error) {
    console.error('❌ Uventet fejl ved tjek af eksisterende øvelser:', error)
    return []
  }
}

async function main() {
  try {
    console.log('🎯 Starter population af exercises database...\n')

    // Tjek forbindelse til Supabase
    console.log('🔌 Tester forbindelse til Supabase...')
    const { data: connectionTest, error: connectionError } = await supabase
      .from('exercises')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ Kan ikke forbinde til Supabase:', connectionError.message)
      return
    }
    console.log('✅ Forbindelse til Supabase OK\n')

    // Tjek eksisterende øvelser
    console.log('🔍 Tjekker eksisterende øvelser i databasen...')
    const existingExercises = await checkExistingExercises()
    console.log(`📊 Fundet ${existingExercises.length} eksisterende øvelser\n`)

    // Indlæs øvelser fra JSON
    const jsonExercises = await loadExercisesFromJSON()
    
    // Map til database format
    console.log('🔄 Konverterer øvelser til database format...')
    const databaseExercises = jsonExercises.map(mapExerciseToDatabase)
    
    // Filtrer ud øvelser der allerede eksisterer
    const newExercises = databaseExercises.filter(ex => 
      !existingExercises.includes(ex.exercise_id)
    )
    
    console.log(`📝 ${newExercises.length} nye øvelser skal indsættes`)
    console.log(`⏭️  ${databaseExercises.length - newExercises.length} øvelser springer vi over (findes allerede)\n`)

    if (newExercises.length === 0) {
      console.log('🎉 Alle øvelser er allerede i databasen!')
      return
    }

    // Indsæt øvelser
    const { insertedCount, errorCount } = await insertExercisesInBatches(newExercises)

    // Sammendrag
    console.log('\n' + '='.repeat(50))
    console.log('📊 SAMMENDRAG:')
    console.log(`✅ ${insertedCount} øvelser blev indsat`)
    console.log(`❌ ${errorCount} øvelser fejlede`)
    console.log(`📁 Alle øvelser er sat til is_active = false`)
    console.log(`🖼️  GIF paths: gifs/{exerciseId}.gif`)
    console.log('='.repeat(50))
    
    if (insertedCount > 0) {
      console.log('\n🎯 Næste skridt:')
      console.log('1. Gå til din Supabase dashboard')
      console.log('2. Find exercises tabellen')
      console.log('3. Sæt is_active = true for de øvelser du vil aktivere')
      console.log('4. Test din app - den vil nu kun vise aktive øvelser! 🚀')
    }

  } catch (error) {
    console.error('💥 Kritisk fejl:', error)
    process.exit(1)
  }
}

// Kør scriptet
main()