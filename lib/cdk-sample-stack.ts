//https://docs.aws.amazon.com/cdk/api/latest/docs/aws-construct-library.html
// 神

import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import ecr = require('@aws-cdk/aws-ecr');
import certmgr = require('@aws-cdk/aws-certificatemanager')
import route53 = require('@aws-cdk/aws-route53');
import targets  = require('@aws-cdk/aws-route53-targets');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import cdk = require('@aws-cdk/core');

// http://js.studio-kingdom.com/typescript/handbook/modules
// http://xn--qiita-u53d2ivhsb.com/chuck0523/items/1868a4c04ab4d8cdfb23#commonjs%E3%81%A8amd
// export = と import = require()
// CommonJSとAMDはどちらも、一般的にはモジュールからexportされた全てのものをexportするというコンセプトを持ちます。
// それ以外にも、exportしたオブジェクトをカスタム・シングルオブジェクトに置換するサポートも行います。 デフォルトexportはこの挙動を置き換えるように意図されていますが、2つを両立することは出来ません。 TypeScriptは伝統的なCommonJSとAMDワークフローのexport =モデルをサポートします。
// export =文法は、モジュールからexportされた単一のオブジェクトを指し示します。 これは、クラス、インターフェース、名前空間、関数、またはenumのいずれかを指定することが可能です。
// export =が使用されたモジュールのimportをするには、 TypeScript特有のimport let = require("module")が使用されなければいけません。


export class CdkSampleStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // aws ecr get-login --region ap-northeast-1  --no-include-email
    //　次に出てくるものをコピペ
    // docker tag nginx:latest 065399384924.dkr.ecr.ap-northeast-1.amazonaws.com/cdksa-sampl-q8zli8pt8ley
    // docker push 065399384924.dkr.ecr.ap-northeast-1.amazonaws.com/cdksa-sampl-q8zli8pt8ley
    //レポジトリ名がへんなのになったcdksa-sampl-q8zli8pt8ley
    //どうやらレポジトリ名の指定はできないみたい。クソ。
    const repository = new ecr.Repository(this, 'sample-cdk-repo');

    // ecs_patterns.NetworkLoadBalancedFargateServiceでやるとなぜかhealth checkが通らず死んだ。理由はわからぬ。
    // そもそもnlbでやる意味もあんまない。
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs-patterns.NetworkLoadBalancedFargateService.html
    // https://dev.classmethod.jp/cloud/aws/elb-network-load-balancer-static-ip-adress/
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "fargateService", {
      cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      // listenerPort: 80,
      taskImageOptions: {
        // image: ecs.ContainerImage.fromRegistry("nginx"),
        image: ecs.ContainerImage.fromEcrRepository(repository),
      },
      // publicLoadBalancer: true
      // あってもなくても変わらん
    });

    // ecs.ContainerImage.fromRegistry(imageName): use a public image.
    // ecs.ContainerImage.fromRegistry(imageName, { credentials: mySecret }): use a private image that requires credentials.
    // ecs.ContainerImage.fromEcrRepository(repo, tag): use the given ECR repository as the image to start. If no tag is provided, "latest" is assumed.
    // ecs.ContainerImage.fromAsset('./image'): build and upload an image directly from a Dockerfile in your source directory.

    // Output the DNS where you can access your service

    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: 'hirokihello.com'
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(fargateService.loadBalancer)),
      // or - route53.RecordTarget.fromAlias(new alias.ApiGatewayDomainName(domainName)),
    });

    //わざわざ作らんといけない。クソだるい
    // cdk bootstrap aws://065399384924/ap-northeast-1をわざわざ打たないといけなかった。クソだるい。
    const hostedZone = route53.HostedZone.fromLookup(this, 'CreatedHostedZone', {
      domainName: 'hirokihello.com',
      privateZone: false
    });

    const certificate = new certmgr.DnsValidatedCertificate(this, 'TestCertificate', {
      domainName: 'hirokihello.com',
      hostedZone,
    });

    const listener = fargateService.loadBalancer.addListener('Listener',
      {
        port: 443,
      }
    );

    // なんかできない
    //　やり方がドキュメントにないし、型が違うと怒られてもわからん。。。
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.IApplicationTargetGroup.html
    //　ここドキュメントだとaddTargetsになってるけど,addTargetGroupsにしないとエラー出る。意味わからん。
    listener.addTargetGroups(
      fargateService.loadBalancer.loadBalancerArn,
      {
        targetGroups: [fargateService.targetGroup],
      });

    listener.addCertificateArns(
      fargateService.loadBalancer.loadBalancerArn,
      [certificate.certificateArn],
    );

    // elbv2とelbについて https://qiita.com/zakky/items/fc9c9da174aafd9f87ff
    // ELBv2 load balancers
    // new route53.ARecord(this, 'AliasRecord', {
    //   zone,
    //   target: route53.RecordTarget.fromAlias(new alias.LoadBalancerTarget(elbv2)),
    //   // or - route53.RecordTarget.fromAlias(new alias.ApiGatewayDomainName(domainName)),
    // });
    // Classic load balancers
    // new route53.ARecord(this, 'AliasRecord', {
    //   zone,
    //   target: route53.RecordTarget.fromAlias(new alias.ClassicLoadBalancerTarget(elb)),
    //   // or - route53.RecordTarget.fromAlias(new alias.ApiGatewayDomainName(domainName)),
    // });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: fargateService.loadBalancer.loadBalancerDnsName });
  }
}
