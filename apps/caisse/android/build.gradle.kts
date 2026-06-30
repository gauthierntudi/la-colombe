buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.jfrog.buildinfo:build-info-extractor-gradle:5.2.5")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://yocotechnologies.jfrog.io/artifactory/public/") }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
