# WorkoutWorker deserializes the generated schema models with Moshi reflection.
# Keep this module's model constructors and fields when the consuming app uses R8.
-keep class com.limajuice.liftlog.** { *; }
-keep class kotlin.Metadata { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,RuntimeVisibleTypeAnnotations,AnnotationDefault
