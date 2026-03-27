variable "IMAGE_TAG" {
  default = "latest"
}

target default {
  context = "."
  dockerfile = "docker/Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["pprof-viz:${IMAGE_TAG}"]
}
