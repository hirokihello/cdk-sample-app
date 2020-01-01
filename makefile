.PHONY: deploy
deploy:
	npm run build
	npm run cdk deploy

.PHONY: build
build:
	npm run build