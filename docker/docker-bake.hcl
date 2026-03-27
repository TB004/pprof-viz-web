variable "IMAGE_TAG" {
  default = "latest"
}

variable "IMAGE_NAME" {
  default = "pprof-viz"
}

target default {
  context = "."
  dockerfile = "docker/Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${IMAGE_NAME}:${IMAGE_TAG}"]
}
